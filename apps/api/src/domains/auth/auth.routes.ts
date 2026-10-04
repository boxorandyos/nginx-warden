import { Router } from 'express';
import { AuthController } from './auth.controller';
import {
  loginValidation,
  verify2FAValidation,
  refreshTokenValidation,
  firstLoginPasswordValidation,
} from './dto';
import { rateLimit } from '../../middleware/rate-limit';
import { rejectUnknownBodyKeys } from '../../middleware/request-shape';

const router = Router();
const authController = new AuthController();

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  rateLimit({ keyPrefix: 'auth-login', windowMs: 60_000, max: 20 }),
  rejectUnknownBodyKeys(['username', 'password', 'providerId']),
  loginValidation,
  authController.login
);

/**
 * @route   POST /api/auth/verify-2fa
 * @desc    Verify 2FA code during login
 * @access  Public
 */
router.post(
  '/verify-2fa',
  rateLimit({ keyPrefix: 'auth-verify-2fa', windowMs: 60_000, max: 30 }),
  rejectUnknownBodyKeys(['userId', 'token']),
  verify2FAValidation,
  authController.verify2FA
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Public
 */
router.post('/logout', rejectUnknownBodyKeys(['refreshToken']), authController.logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  rateLimit({ keyPrefix: 'auth-refresh', windowMs: 60_000, max: 40 }),
  rejectUnknownBodyKeys(['refreshToken']),
  refreshTokenValidation,
  authController.refreshAccessToken
);

/**
 * @route   POST /api/auth/first-login/change-password
 * @desc    Change password on first login
 * @access  Public
 */
router.post(
  '/first-login/change-password',
  rateLimit({ keyPrefix: 'auth-first-login-password', windowMs: 60_000, max: 20 }),
  rejectUnknownBodyKeys(['userId', 'tempToken', 'newPassword']),
  firstLoginPasswordValidation,
  authController.changePasswordFirstLogin
);

export default router;
