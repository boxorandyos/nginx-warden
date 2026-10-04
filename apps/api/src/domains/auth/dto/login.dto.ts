import { body, ValidationChain } from 'express-validator';

/**
 * Login request DTO
 */
export interface LoginDto {
  username: string;
  password: string;
  /** Optional IdP id — defaults to Local when allowed */
  providerId?: string;
}

/**
 * Login validation rules
 */
export const loginValidation: ValidationChain[] = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 1 })
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  body('providerId').optional().isString(),
];
