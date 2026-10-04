import { hashPassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTempToken,
  verifyTempToken,
  verifyRefreshToken,
} from '../../utils/jwt';
import { verify2FAToken } from '../../utils/twoFactor';
import logger from '../../utils/logger';
import { AuthRepository } from './auth.repository';
import {
  LoginDto,
  RefreshTokenDto,
  Verify2FADto,
  LogoutDto,
  FirstLoginPasswordDto,
} from './dto';
import {
  LoginResponse,
  LoginResult,
  Login2FARequiredResult,
  LoginFirstTimeResult,
  RefreshTokenResult,
  RequestMetadata,
  TokenPayload,
  UserData,
} from './auth.types';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
} from '../../shared/errors/app-error';
import { AuthProviderType, AuthRequirementTarget, AuthAuditOutcome } from '@prisma/client';
import {
  ensureIdentityDefaults,
  resolvePolicy,
  evaluateGroupRestrictions,
  getIdpForType,
} from '../identity/services/policy.service';
import { authAbuseService, authAuditService } from '../identity/services/auth-audit-abuse.service';
import prisma from '../../config/database';

/**
 * Auth service - Contains all authentication business logic
 */
export class AuthService {
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;
  private readonly SESSION_EXPIRY_DAYS = 7;

  constructor(private readonly authRepository: AuthRepository) {}

  /**
   * Login user with username and password (Local IdP via Admin portal policy).
   * LDAP/OIDC will plug into the same policy path in later phases.
   */
  async login(
    dto: LoginDto,
    metadata: RequestMetadata
  ): Promise<LoginResponse> {
    const { username, password } = dto;

    await ensureIdentityDefaults();

    try {
      await authAbuseService.assertAllowed({ ip: metadata.ip });
    } catch (e: any) {
      await authAuditService.write({
        outcome: AuthAuditOutcome.blocked,
        message: `Login blocked: ${e.message}`,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        username,
      });
      throw new AuthenticationError(this.mapAbuseMessage(e.message));
    }

    const policy = await resolvePolicy(AuthRequirementTarget.admin_portal);
    if (!policy) {
      throw new AuthenticationError('Authentication is not configured');
    }

    if (!policy.allowedProviderTypes.includes(AuthProviderType.local)) {
      await authAuditService.write({
        outcome: AuthAuditOutcome.blocked,
        message: 'Local authentication is not allowed by admin portal policy',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        username,
        policyId: policy.id,
        providerType: AuthProviderType.local,
      });
      throw new AuthenticationError(
        'Local authentication is not allowed for the admin portal'
      );
    }

    const localProvider = await prisma.authProviderConfig.findFirst({
      where: { type: AuthProviderType.local, enabled: true },
    });

    const idp = getIdpForType(AuthProviderType.local);
    if (!idp) {
      throw new AuthenticationError('Local identity provider is unavailable');
    }

    const authResult = await idp.authenticate({ username, password });

    // Pre-lookup for abuse keyed by user id when username exists
    const existingUser = await this.authRepository.findUserByUsername(username);

    if (!authResult.ok) {
      await this.authRepository.createActivityLog(
        existingUser?.id ?? null,
        `Failed login attempt for username: ${username}`,
        'security',
        metadata,
        false,
        authResult.reason
      );

      const abuse = await authAbuseService.recordFailure({
        userId: existingUser?.id ?? null,
        ip: metadata.ip,
        username,
      });

      await authAuditService.write({
        outcome: abuse.userLocked || abuse.ipLocked ? AuthAuditOutcome.lockout : AuthAuditOutcome.failure,
        message: `Failed login: ${authResult.reason}`,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        username,
        userId: existingUser?.id ?? null,
        policyId: policy.id,
        providerType: AuthProviderType.local,
        providerId: localProvider?.id ?? null,
        details: abuse,
      });

      if (existingUser) {
        try {
          await authAbuseService.assertAllowed({
            userId: existingUser.id,
            ip: metadata.ip,
          });
        } catch (e: any) {
          throw new AuthenticationError(this.mapAbuseMessage(e.message));
        }
      }

      throw new AuthenticationError('Invalid credentials');
    }

    const user = await this.authRepository.findUserByUsername(authResult.identity.username);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    try {
      await authAbuseService.assertAllowed({ userId: user.id, ip: metadata.ip });
    } catch (e: any) {
      await authAuditService.write({
        outcome: AuthAuditOutcome.blocked,
        message: `Login blocked after credential check: ${e.message}`,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        username,
        userId: user.id,
        policyId: policy.id,
        providerType: AuthProviderType.local,
      });
      throw new AuthenticationError(this.mapAbuseMessage(e.message));
    }

    if (user.status !== 'active') {
      throw new AuthorizationError('Account is inactive or suspended');
    }

    const groups = [...(user.externalGroups || []), ...authResult.identity.groups];
    const groupCheck = evaluateGroupRestrictions(policy, groups);
    if (!groupCheck.allowed) {
      await authAuditService.write({
        outcome: AuthAuditOutcome.blocked,
        message: groupCheck.reason || 'Group restriction',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        username,
        userId: user.id,
        policyId: policy.id,
        providerType: AuthProviderType.local,
      });
      throw new AuthorizationError(groupCheck.reason || 'Access denied by group policy');
    }

    await authAbuseService.recordSuccess({ userId: user.id, ip: metadata.ip });

    // Check if this is first login
    if (user.isFirstLogin) {
      logger.info(`User ${username} is logging in for the first time`);

      const userData = this.mapUserData(user);
      const tempToken = generateTempToken(user.id);

      const result: LoginFirstTimeResult = {
        requirePasswordChange: true,
        userId: user.id,
        tempToken,
        user: userData,
      };

      return result;
    }

    // Policy or user 2FA
    const requireMfa = policy.requireMfa || Boolean(user.twoFactor?.enabled);
    if (requireMfa) {
      if (!user.twoFactor?.enabled) {
        // Policy requires MFA but user has not enrolled — still challenge path via existing setup
        logger.info(`User ${username} requires 2FA (policy or user setting)`);
      }
      if (user.twoFactor?.enabled) {
        logger.info(`User ${username} requires 2FA verification`);
        const userData = this.mapUserData(user);
        const result: Login2FARequiredResult = {
          requires2FA: true,
          userId: user.id,
          user: userData,
        };
        return result;
      }
      if (policy.requireMfa && !user.twoFactor?.enabled) {
        await authAuditService.write({
          outcome: AuthAuditOutcome.challenge,
          message: 'MFA required by policy but user has not enrolled',
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          username,
          userId: user.id,
          policyId: policy.id,
          providerType: AuthProviderType.local,
        });
        throw new AuthorizationError(
          'Multi-factor authentication is required. Enroll 2FA from a prior Local session or contact an administrator.'
        );
      }
    }

    await authAuditService.write({
      outcome: AuthAuditOutcome.success,
      message: 'Login succeeded',
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      username,
      userId: user.id,
      policyId: policy.id,
      providerType: AuthProviderType.local,
      providerId: localProvider?.id ?? null,
    });

    return this.completeLogin(user, metadata);
  }

  private mapAbuseMessage(code: string): string {
    switch (code) {
      case 'AUTH_CIRCUIT_OPEN':
        return 'Authentication temporarily disabled due to too many failed attempts. Try again later or contact an administrator.';
      case 'AUTH_IP_BLOCKED':
      case 'AUTH_IP_LOCKED':
        return 'Too many failed attempts from this network address. Try again later.';
      case 'AUTH_USER_BLOCKED':
      case 'AUTH_USER_LOCKED':
        return 'This account is temporarily locked due to failed login attempts.';
      default:
        return 'Authentication denied';
    }
  }

  /**
   * Verify 2FA token and complete login
   */
  async verify2FA(
    dto: Verify2FADto,
    metadata: RequestMetadata
  ): Promise<LoginResult> {
    const { userId, token } = dto;

    // Find user
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if 2FA is enabled
    if (!user.twoFactor || !user.twoFactor.enabled || !user.twoFactor.secret) {
      throw new ValidationError('2FA is not enabled for this account');
    }

    // Verify token
    const isValid = verify2FAToken(token, user.twoFactor.secret);

    if (!isValid) {
      // Log failed attempt
      await this.authRepository.createActivityLog(
        user.id,
        'Failed 2FA verification',
        'security',
        metadata,
        false,
        'Invalid 2FA token'
      );

      throw new AuthenticationError('Invalid 2FA token');
    }

    // Complete login with 2FA
    logger.info(`User ${user.username} logged in successfully with 2FA`);
    return this.completeLogin(user, metadata, true);
  }

  /**
   * Logout user
   */
  async logout(
    dto: LogoutDto,
    userId: string | undefined,
    metadata: RequestMetadata
  ): Promise<void> {
    const { refreshToken } = dto;

    // Revoke refresh token if provided and drop matching session row
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        await this.authRepository.revokeRefreshToken(refreshToken);
        if (userId && decoded.userId === userId) {
          await this.authRepository.deleteUserSession(userId, decoded.jti);
        }
      } catch {
        await this.authRepository.revokeRefreshToken(refreshToken);
      }
    }

    // Log logout
    if (userId) {
      await this.authRepository.createActivityLog(
        userId,
        'User logged out',
        'logout',
        metadata,
        true
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(dto: RefreshTokenDto): Promise<RefreshTokenResult> {
    const { refreshToken } = dto;

    // Verify refresh token exists
    const tokenRecord = await this.authRepository.findRefreshToken(refreshToken);

    if (!tokenRecord) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if token is valid
    if (!this.authRepository.isRefreshTokenValid(tokenRecord)) {
      if (tokenRecord.revokedAt) {
        throw new AuthenticationError('Invalid refresh token');
      }
      throw new AuthenticationError('Refresh token expired');
    }

    let sessionJti: string;
    try {
      const verified = verifyRefreshToken(refreshToken);
      sessionJti = verified.jti;
    } catch {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Generate new tokens (rotate refresh JWT; keep same jti so the browser session stays identifiable)
    const tokenPayload = this.createTokenPayload(tokenRecord.user);
    const accessToken = generateAccessToken({ ...tokenPayload, sessionId: sessionJti });
    const { token: newRefreshToken, jti } = generateRefreshToken(tokenPayload, sessionJti);

    // Revoke old refresh token
    await this.authRepository.revokeRefreshToken(refreshToken);

    // Save new refresh token
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    await this.authRepository.saveRefreshToken(tokenRecord.user.id, newRefreshToken, expiresAt, jti);

    await this.authRepository.touchUserSession(tokenRecord.user.id, jti);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Change password on first login
   */
  async changePasswordFirstLogin(
    dto: FirstLoginPasswordDto,
    metadata: RequestMetadata
  ): Promise<LoginResult> {
    const { userId, tempToken, newPassword } = dto;

    // Verify temp token
    try {
      const payload = verifyTempToken(tempToken);
      if (payload.userId !== userId) {
        throw new AuthenticationError('Invalid token');
      }
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Find user
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user is still in first login state
    if (!user.isFirstLogin) {
      throw new ValidationError('Password has already been changed');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and set isFirstLogin to false
    await this.authRepository.updateUserPassword(userId, hashedPassword);
    await this.authRepository.updateUserFirstLoginStatus(userId, false);

    // Log activity
    await this.authRepository.createActivityLog(
      userId,
      'Changed password on first login',
      'security',
      metadata,
      true
    );

    logger.info(`User ${user.username} changed password on first login`);

    // Generate tokens and complete login (no need to login again)
    const result = await this.completeLogin(user, metadata, false);
    
    // Add flag to indicate if 2FA setup is needed
    return {
      ...result,
      require2FASetup: !user.twoFactor?.enabled,
    };
  }

  /**
   * Complete login process (generate tokens, update user, create session, log activity)
   */
  private async completeLogin(
    user: UserData & { id: string; username: string },
    metadata: RequestMetadata,
    is2FA: boolean = false
  ): Promise<LoginResult> {
    // Generate tokens
    const tokenPayload = this.createTokenPayload(user);
    const { token: refreshToken, jti } = generateRefreshToken(tokenPayload);
    const accessToken = generateAccessToken({ ...tokenPayload, sessionId: jti });

    // Save refresh token
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    await this.authRepository.saveRefreshToken(user.id, refreshToken, expiresAt, jti);

    // Update last login
    await this.authRepository.updateLastLogin(user.id);

    // Log successful login
    const action = is2FA ? 'User logged in with 2FA' : 'User logged in';
    await this.authRepository.createActivityLog(
      user.id,
      action,
      'login',
      metadata,
      true
    );

    // Create session (session id matches refresh token jti)
    const sessionExpiresAt = new Date(
      Date.now() + this.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    await this.authRepository.createUserSession(
      user.id,
      jti,
      metadata,
      sessionExpiresAt
    );

    logger.info(`User ${user.username} logged in successfully${is2FA ? ' with 2FA' : ''}`);

    // Return user data and tokens
    const userData = this.mapUserData(user);
    return {
      user: userData,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Create token payload from user
   */
  private createTokenPayload(user: {
    id: string;
    username: string;
    email: string;
    role: string;
  }): TokenPayload {
    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Map user entity to UserData type
   */
  private mapUserData(user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    avatar: string | null;
    phone: string | null;
    timezone: string;
    language: string;
    lastLogin: Date | null;
  }): UserData {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      timezone: user.timezone,
      language: user.language,
      lastLogin: user.lastLogin,
    };
  }
}