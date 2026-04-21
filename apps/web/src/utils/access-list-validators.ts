/**
 * Access List Validation Utilities
 * Returns i18n keys for use with react-i18next t()
 */

import { isValidIpOrCidr } from './acl-validators';

export type AccessListFieldValidation =
  | { valid: true }
  | { valid: false; errorKey: string; errorParams?: Record<string, string | number> };

/**
 * Validate access list name
 */
export function validateAccessListName(name: string): AccessListFieldValidation {
  if (!name || name.trim().length === 0) {
    return { valid: false, errorKey: 'accessLists.validation.nameRequired' };
  }

  if (name.length < 3) {
    return { valid: false, errorKey: 'accessLists.validation.nameMin' };
  }

  if (name.length > 100) {
    return { valid: false, errorKey: 'accessLists.validation.nameMax' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { valid: false, errorKey: 'accessLists.validation.nameChars' };
  }

  return { valid: true };
}

/**
 * Validate IP address for access list
 */
export function validateAccessListIp(ip: string): AccessListFieldValidation {
  if (!ip || ip.trim().length === 0) {
    return { valid: false, errorKey: 'accessLists.validation.ipRequired' };
  }

  if (!isValidIpOrCidr(ip)) {
    return { valid: false, errorKey: 'accessLists.validation.ipInvalid' };
  }

  return { valid: true };
}

/**
 * Validate username for HTTP Basic Auth
 */
export function validateUsername(username: string): AccessListFieldValidation {
  if (!username || username.trim().length === 0) {
    return { valid: false, errorKey: 'accessLists.validation.usernameRequired' };
  }

  if (username.length < 3) {
    return { valid: false, errorKey: 'accessLists.validation.usernameMin' };
  }

  if (username.length > 50) {
    return { valid: false, errorKey: 'accessLists.validation.usernameMax' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, errorKey: 'accessLists.validation.usernameChars' };
  }

  return { valid: true };
}

/**
 * Validate password for HTTP Basic Auth
 */
export function validatePassword(password: string, isRequired: boolean = true): AccessListFieldValidation {
  if (!isRequired && (!password || password.length === 0)) {
    return { valid: true };
  }

  if (!password || password.trim().length === 0) {
    return { valid: false, errorKey: 'accessLists.validation.passwordRequired' };
  }

  if (password.length < 4) {
    return { valid: false, errorKey: 'accessLists.validation.passwordMin' };
  }

  return { valid: true };
}

/**
 * Validate description
 */
export function validateDescription(description: string, maxLength: number = 500): AccessListFieldValidation {
  if (description && description.length > maxLength) {
    return {
      valid: false,
      errorKey: 'accessLists.validation.descriptionMax',
      errorParams: { max: maxLength },
    };
  }

  return { valid: true };
}

const HINT_KEYS: Record<string, string> = {
  name: 'accessLists.hint.name',
  ip: 'accessLists.hint.ip',
  username: 'accessLists.hint.username',
  password: 'accessLists.hint.password',
  description: 'accessLists.hint.description',
};

export function getAccessListHintKey(field: string): string {
  return HINT_KEYS[field] || 'accessLists.hint.fallback';
}

/**
 * Get example values for access list fields
 */
export function getAccessListExample(field: string): string {
  const examples: Record<string, string> = {
    name: 'admin-panel-access',
    ip: '192.168.1.1',
    ipCidr: '192.168.1.0/24',
    username: 'admin_user',
    password: '••••••••',
    description: 'Access for admin panel',
  };

  return examples[field] || '';
}
