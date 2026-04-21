import { z } from 'zod';
import { SUPPORTED_UI_LANGUAGE_CODES } from '../../../shared/constants/ui-languages.constants';

/**
 * Update profile request validation schema
 */
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .optional(),
  email: z
    .string()
    .email('Invalid email address')
    .optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable(),
  timezone: z
    .string()
    .trim()
    .optional(),
  language: z.enum(SUPPORTED_UI_LANGUAGE_CODES).optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
