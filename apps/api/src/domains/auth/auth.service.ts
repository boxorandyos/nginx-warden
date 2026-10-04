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
  createPasswordIdp,
} from '../identity/services/policy.service';
import { authAbuseService, authAuditService } from '../identity/services/auth-audit-abuse.service';
import { upsertExternalUser } from '../identity/services/jit-user.service';
import prisma from '../../config/database';

/**
 * Auth service - Contains all authentication business logic
 */
export class AuthService {
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;
  private readonly SESSION_EXPIRY_DAYS = 7;

  constructor(private readonly authRepository: AuthRepository) {}

  /**
   * Password login for admin portal via Local or LDAP (OIDC uses browser redirect).
   */
  async login(
    dto: LoginDto,
    metadata: RequestMetadata
  ): Promise<LoginResponse> {
    const { username, password, providerId: requestedProviderId } = dto;

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

    // Resolve password-capable provider
    let providerRow = requestedProviderId
      ? await prisma.authProviderConfig.findUnique({ where: { id: requestedProviderId } })
      : await prisma.authProviderConfig.findFirst({
          where: {
            type: AuthProviderType.local,
            enabled: true,
            id: { in: policy.allowedProviderIds },
          },
        });

    if (!providerRow) {
      providerRow = await prisma.authProviderConfig.findFirst({
        where: {
          enabled: true,
          id: { in: policy.allowedProviderIds },
          type: { in: [AuthProviderType.local, AuthProviderType.ldap] },
        },
        orderBy: { priority: 'asc' },
      });
    }

    if (!providerRow || !providerRow.enabled) {
      throw new AuthenticationError('No password identity provider is available for the admin portal');
    }
    if (!policy.allowedProviderIds.includes(providerRow.id)) {
      throw new AuthenticationError('Selected identity provider is not allowed by policy');
    }
    if (
      providerRow.type !== AuthProviderType.local &&
      providerRow.type !== AuthProviderType.ldap
    ) {
      throw new AuthenticationError('Use the SSO button for this identity provider');
    }

    const idpBundle = await createPasswordIdp(providerRow.id);
    if (!idpBundle) {
      throw new AuthenticationError('Identity provider is unavailable');
    }

    const authResult = await idpBundle.idp.authenticate({ username, password });
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
        outcome:
          abuse.userLocked || abuse.ipLocked
            ? AuthAuditOutcome.lockout
            : AuthAuditOutcome.failure,
        message: `Failed login: ${authResult.reason}`,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        username,
        userId: existingUser?.id ?? null,
        policyId: policy.id,
        providerType: providerRow.type,
        providerId: providerRow.id,
        details: abuse,
      });

      throw new AuthenticationError('Invalid credentials');
    }

    const user =
      providerRow.type === AuthProviderType.local
        ? await this.authRepository.findUserByUsername(authResult.identity.username)
        : await upsertExternalUser(providerRow.type, authResult.identity);

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Attach twoFactor if missing from JIT shape
    const userWith2fa =
      'twoFactor' in user && user.twoFactor !== undefined
        ? user
        : await this.authRepository.findUserById(user.id);

    if (!userWith2fa) {
      throw new AuthenticationError('Invalid credentials');
    }

    try {
      await authAbuseService.assertAllowed({ userId: userWith2fa.id, ip: metadata.ip });
    } catch (e: any) {
      throw new AuthenticationError(this.mapAbuseMessage(e.message));
    }

    if (userWith2fa.status !== 'active') {
      throw new AuthorizationError('Account is inactive or suspended');
    }

    const groups = [
      ...((userWith2fa as any).externalGroups || []),
      ...authResult.identity.groups,
    ];
    const groupCheck = evaluateGroupRestrictions(policy, groups);
    if (!groupCheck.allowed) {
      await authAuditService.write({
        outcome: AuthAuditOutcome.blocked,
        message: groupCheck.reason || 'Group restriction',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        username,
        userId: userWith2fa.id,
        policyId: policy.id,
        providerType: providerRow.type,
      });
      throw new AuthorizationError(groupCheck.reason || 'Access denied by group policy');
    }

    await authAbuseService.recordSuccess({ userId: userWith2fa.id, ip: metadata.ip });

    if (userWith2fa.isFirstLogin && providerRow.type === AuthProviderType.local) {
      logger.info(`User ${username} is logging in for the first time`);
      const userData = this.mapUserData(userWith2fa);
      return {
        requirePasswordChange: true,
        userId: userWith2fa.id,
        tempToken: generateTempToken(userWith2fa.id),
        user: userData,
      };
    }

    const requireMfa = policy.requireMfa || Boolean(userWith2fa.twoFactor?.enabled);
    if (requireMfa) {
      if (userWith2fa.twoFactor?.enabled) {
        return {
          requires2FA: true,
          userId: userWith2fa.id,
          user: this.mapUserData(userWith2fa),
        };
      }
      if (policy.requireMfa) {
        throw new AuthorizationError(
          'Multi-factor authentication is required. Enroll 2FA before using this portal policy.'
        );
      }
    }

    await authAuditService.write({
      outcome: AuthAuditOutcome.success,
      message: 'Login succeeded',
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      username: userWith2fa.username,
      userId: userWith2fa.id,
      policyId: policy.id,
      providerType: providerRow.type,
      providerId: providerRow.id,
    });

    return this.completeLogin(userWith2fa as any, metadata);
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

  /** Used by OIDC callback to issue portal tokens after external IdP success */
  async completeLoginPublic(user: any, metadata: RequestMetadata, is2FA = false): Promise<LoginResult> {
    return this.completeLogin(user, metadata, is2FA);
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