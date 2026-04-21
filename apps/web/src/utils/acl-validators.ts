/**
 * Frontend ACL Validation Utilities
 * Mirrors backend validation for real-time feedback.
 * Errors are i18n keys under acl.validation.* — translate with t() in the UI.
 */

export type AclValidationResult =
  | { valid: true }
  | { valid: false; errorKey: string; errorParams?: Record<string, string> };

/**
 * Validate IP address (IPv4 or IPv6)
 */
export function isValidIpAddress(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export function isValidCidr(cidr: string): boolean {
  const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
  const cidrV6Regex = /^(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{0,4}\/(?:[0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/;
  return cidrRegex.test(cidr) || cidrV6Regex.test(cidr);
}

export function isValidIpOrCidr(value: string): boolean {
  return isValidIpAddress(value) || isValidCidr(value);
}

export function isValidRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

export function isValidUrlPattern(pattern: string): boolean {
  if (!pattern || pattern.trim().length === 0) {
    return false;
  }
  const dangerousChars = /[;<>{}|\\]/;
  return !dangerousChars.test(pattern);
}

export function isValidHttpMethod(method: string): boolean {
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'];
  return validMethods.includes(method.toUpperCase());
}

export function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

export function isValidUserAgentPattern(pattern: string): boolean {
  if (!pattern || pattern.trim().length === 0) {
    return false;
  }
  const dangerousChars = /[;<>{}|\\]/;
  return !dangerousChars.test(pattern);
}

export function isValidHeaderName(name: string): boolean {
  return /^[a-zA-Z0-9\-_]+$/.test(name);
}

export function validateAclValue(field: string, operator: string, value: string): AclValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, errorKey: 'acl.validation.valueEmpty' };
  }

  switch (field) {
    case 'ip':
      if (operator === 'equals' || operator === 'contains') {
        if (!isValidIpOrCidr(value)) {
          return { valid: false, errorKey: 'acl.validation.ipInvalid' };
        }
      } else if (operator === 'regex') {
        const regexCheck = isValidRegex(value);
        if (!regexCheck.valid) {
          return {
            valid: false,
            errorKey: 'acl.validation.regexInvalid',
            errorParams: { detail: regexCheck.error || '' },
          };
        }
      }
      break;

    case 'geoip':
      if (operator === 'equals') {
        if (!isValidCountryCode(value)) {
          return { valid: false, errorKey: 'acl.validation.countryInvalid' };
        }
      } else if (operator === 'regex') {
        const regexCheck = isValidRegex(value);
        if (!regexCheck.valid) {
          return {
            valid: false,
            errorKey: 'acl.validation.regexInvalid',
            errorParams: { detail: regexCheck.error || '' },
          };
        }
      }
      break;

    case 'user-agent':
      if (operator === 'regex') {
        const regexCheck = isValidRegex(value);
        if (!regexCheck.valid) {
          return {
            valid: false,
            errorKey: 'acl.validation.regexInvalid',
            errorParams: { detail: regexCheck.error || '' },
          };
        }
      } else if (!isValidUserAgentPattern(value)) {
        return { valid: false, errorKey: 'acl.validation.userAgentInvalid' };
      }
      break;

    case 'url':
      if (operator === 'regex') {
        const regexCheck = isValidRegex(value);
        if (!regexCheck.valid) {
          return {
            valid: false,
            errorKey: 'acl.validation.regexInvalid',
            errorParams: { detail: regexCheck.error || '' },
          };
        }
      } else if (!isValidUrlPattern(value)) {
        return { valid: false, errorKey: 'acl.validation.urlInvalid' };
      }
      break;

    case 'method':
      if (operator === 'equals' && !isValidHttpMethod(value)) {
        return { valid: false, errorKey: 'acl.validation.methodInvalid' };
      }
      break;

    case 'header': {
      const headerParts = value.split(':');
      if (headerParts.length < 2) {
        return { valid: false, errorKey: 'acl.validation.headerFormat' };
      }
      const headerName = headerParts[0]?.trim() || '';
      if (!isValidHeaderName(headerName)) {
        return { valid: false, errorKey: 'acl.validation.headerNameInvalid' };
      }
      break;
    }

    default:
      return { valid: false, errorKey: 'acl.validation.unknownField', errorParams: { field } };
  }

  return { valid: true };
}

const HINT_KEYS: Record<string, Record<string, string>> = {
  ip: {
    equals: 'acl.hint.ip.equals',
    contains: 'acl.hint.ip.contains',
    regex: 'acl.hint.ip.regex',
  },
  geoip: {
    equals: 'acl.hint.geoip.equals',
    contains: 'acl.hint.geoip.contains',
    regex: 'acl.hint.geoip.regex',
  },
  'user-agent': {
    equals: 'acl.hint.userAgent.equals',
    contains: 'acl.hint.userAgent.contains',
    regex: 'acl.hint.userAgent.regex',
  },
  url: {
    equals: 'acl.hint.url.equals',
    contains: 'acl.hint.url.contains',
    regex: 'acl.hint.url.regex',
  },
  method: {
    equals: 'acl.hint.method.equals',
    contains: 'acl.hint.method.contains',
    regex: 'acl.hint.method.regex',
  },
  header: {
    equals: 'acl.hint.header.equals',
    contains: 'acl.hint.header.contains',
    regex: 'acl.hint.header.regex',
  },
};

/** i18n key for hint, or acl.hint.fallback */
export function getAclHintKey(field: string, operator: string): string {
  return HINT_KEYS[field]?.[operator] || 'acl.hint.fallback';
}

const EXAMPLES: Record<string, Record<string, string>> = {
  ip: {
    equals: '192.168.1.1',
    contains: '192.168.1.0/24',
    regex: '^192\\.168\\.',
  },
  geoip: {
    equals: 'US',
    contains: 'US,CN,VN',
    regex: '(US|CN|VN)',
  },
  'user-agent': {
    equals: 'Mozilla/5.0',
    contains: 'bot',
    regex: '(bot|crawler|spider)',
  },
  url: {
    equals: '/admin',
    contains: '/api/',
    regex: '\\.(php|asp)$',
  },
  method: {
    equals: 'POST',
    contains: 'POST',
    regex: '(POST|PUT|DELETE)',
  },
  header: {
    equals: 'X-Custom-Header: value',
    contains: 'X-Custom-Header: value',
    regex: 'X-Custom-Header: .*',
  },
};

export function getExampleValue(field: string, operator: string): string {
  return EXAMPLES[field]?.[operator] || '';
}
