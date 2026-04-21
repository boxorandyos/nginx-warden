/**
 * Network Load Balancer Validation Utilities
 * Validates NLB configuration to prevent nginx errors.
 * Messages are i18n keys (nlbForm.*); translate at display time with react-i18next.
 */

export type ValidationIssue = { key: string; values?: Record<string, unknown> };

function issue(key: string, values?: Record<string, unknown>): ValidationIssue {
  return values ? { key, values } : { key };
}

/**
 * Validate IP address (IPv4 or IPv6) or hostname
 */
export function isValidHost(host: string): boolean {
  if (!host || host.trim().length === 0) {
    return false;
  }

  host = host.trim();

  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(host)) {
    return true;
  }

  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(host)) {
    return true;
  }

  if (/^[\d.]+$/.test(host)) {
    return false;
  }

  const hostnameRegex = /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)*(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;

  if (hostnameRegex.test(host)) {
    const labels = host.split('.');
    const allNumeric = labels.every(label => /^\d+$/.test(label));
    if (allNumeric) {
      return false;
    }
    return true;
  }

  return false;
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function isValidNLBPort(port: number): boolean {
  return Number.isInteger(port) && port >= 10000 && port <= 65535;
}

export function isValidWeight(weight: number): boolean {
  return Number.isInteger(weight) && weight >= 1 && weight <= 100;
}

export function isValidMaxFails(maxFails: number): boolean {
  return Number.isInteger(maxFails) && maxFails >= 0 && maxFails <= 100;
}

export function isValidFailTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout >= 1 && timeout <= 3600;
}

export function isValidMaxConns(maxConns: number): boolean {
  return Number.isInteger(maxConns) && maxConns >= 0 && maxConns <= 100000;
}

export function isValidProxyTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout >= 1 && timeout <= 3600;
}

export function isValidProxyConnectTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout >= 1 && timeout <= 300;
}

export function isValidProxyNextUpstreamTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout >= 0 && timeout <= 3600;
}

export function isValidProxyNextUpstreamTries(tries: number): boolean {
  return Number.isInteger(tries) && tries >= 0 && tries <= 100;
}

export function isValidHealthCheckInterval(interval: number): boolean {
  return Number.isInteger(interval) && interval >= 5 && interval <= 3600;
}

export function isValidHealthCheckTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout >= 1 && timeout <= 300;
}

export function isValidHealthCheckRises(rises: number): boolean {
  return Number.isInteger(rises) && rises >= 1 && rises <= 10;
}

export function isValidHealthCheckFalls(falls: number): boolean {
  return Number.isInteger(falls) && falls >= 1 && falls <= 10;
}

export function isValidNLBName(name: string): { valid: boolean; errorKey?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, errorKey: 'nlbForm.validation.nameEmpty' };
  }

  if (name.length < 3) {
    return { valid: false, errorKey: 'nlbForm.validation.nameMin' };
  }

  if (name.length > 50) {
    return { valid: false, errorKey: 'nlbForm.validation.nameMax' };
  }

  const nameRegex = /^[a-zA-Z0-9\-_]+$/;
  if (!nameRegex.test(name)) {
    return { valid: false, errorKey: 'nlbForm.validation.nameChars' };
  }

  if (/^[-_]|[-_]$/.test(name)) {
    return { valid: false, errorKey: 'nlbForm.validation.nameEnds' };
  }

  return { valid: true };
}

export function validateUpstreamHost(host: string): { valid: boolean; errorKey?: string } {
  if (!host || host.trim().length === 0) {
    return { valid: false, errorKey: 'nlbForm.validation.hostRequired' };
  }

  if (!isValidHost(host)) {
    return { valid: false, errorKey: 'nlbForm.validation.hostInvalid' };
  }

  return { valid: true };
}

export function validateUpstreamPort(port: number): { valid: boolean; errorKey?: string } {
  if (!port) {
    return { valid: false, errorKey: 'nlbForm.validation.upstreamPortRequired' };
  }

  if (!isValidPort(port)) {
    return { valid: false, errorKey: 'nlbForm.validation.upstreamPortRange' };
  }

  return { valid: true };
}

export function validateUpstream(upstream: {
  host: string;
  port: number;
  weight: number;
  maxFails: number;
  failTimeout: number;
  maxConns: number;
}): { valid: boolean; errors: Record<string, ValidationIssue> } {
  const errors: Record<string, ValidationIssue> = {};

  const hostValidation = validateUpstreamHost(upstream.host);
  if (!hostValidation.valid) {
    errors.host = issue(hostValidation.errorKey!);
  }

  const portValidation = validateUpstreamPort(upstream.port);
  if (!portValidation.valid) {
    errors.port = issue(portValidation.errorKey!);
  }

  if (!isValidWeight(upstream.weight)) {
    errors.weight = issue('nlbForm.validation.weightRange');
  }

  if (!isValidMaxFails(upstream.maxFails)) {
    errors.maxFails = issue('nlbForm.validation.maxFailsRange');
  }

  if (!isValidFailTimeout(upstream.failTimeout)) {
    errors.failTimeout = issue('nlbForm.validation.failTimeoutRange');
  }

  if (!isValidMaxConns(upstream.maxConns)) {
    errors.maxConns = issue('nlbForm.validation.maxConnsRange');
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateNLBConfig(config: {
  name: string;
  port: number;
  upstreams: Array<{
    host: string;
    port: number;
    weight: number;
    maxFails: number;
    failTimeout: number;
    maxConns: number;
    backup: boolean;
    down: boolean;
  }>;
  proxyTimeout: number;
  proxyConnectTimeout: number;
  proxyNextUpstreamTimeout: number;
  proxyNextUpstreamTries: number;
  healthCheckEnabled: boolean;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  healthCheckRises?: number;
  healthCheckFalls?: number;
}): { valid: boolean; errors: Record<string, ValidationIssue> } {
  const errors: Record<string, ValidationIssue> = {};

  const nameValidation = isValidNLBName(config.name);
  if (!nameValidation.valid) {
    errors.name = issue(nameValidation.errorKey!);
  }

  if (!isValidNLBPort(config.port)) {
    errors.port = issue('nlbForm.validation.portRange');
  }

  if (!config.upstreams || config.upstreams.length === 0) {
    errors.upstreams = issue('nlbForm.validation.upstreamsRequired');
  } else {
    const upstreamKeys = new Set<string>();
    const duplicates: string[] = [];

    config.upstreams.forEach((upstream) => {
      const key = `${upstream.host}:${upstream.port}`;
      if (upstreamKeys.has(key)) {
        duplicates.push(key);
      }
      upstreamKeys.add(key);
    });

    if (duplicates.length > 0) {
      errors.upstreams = issue('nlbForm.validation.duplicateUpstreams', { list: duplicates.join(', ') });
    }

    const activeUpstreams = config.upstreams.filter(u => !u.down && !u.backup);
    if (activeUpstreams.length === 0) {
      errors.upstreams = issue('nlbForm.validation.upstreamsNoActive');
    }
  }

  if (!isValidProxyTimeout(config.proxyTimeout)) {
    errors.proxyTimeout = issue('nlbForm.validation.proxyTimeoutRange');
  }

  if (!isValidProxyConnectTimeout(config.proxyConnectTimeout)) {
    errors.proxyConnectTimeout = issue('nlbForm.validation.proxyConnectTimeoutRange');
  }

  if (!isValidProxyNextUpstreamTimeout(config.proxyNextUpstreamTimeout)) {
    errors.proxyNextUpstreamTimeout = issue('nlbForm.validation.proxyNextUpstreamTimeoutRange');
  }

  if (!isValidProxyNextUpstreamTries(config.proxyNextUpstreamTries)) {
    errors.proxyNextUpstreamTries = issue('nlbForm.validation.proxyNextUpstreamTriesRange');
  }

  if (config.healthCheckEnabled) {
    if (config.healthCheckInterval !== undefined && !isValidHealthCheckInterval(config.healthCheckInterval)) {
      errors.healthCheckInterval = issue('nlbForm.validation.healthCheckIntervalRange');
    }

    if (config.healthCheckTimeout !== undefined && !isValidHealthCheckTimeout(config.healthCheckTimeout)) {
      errors.healthCheckTimeout = issue('nlbForm.validation.healthCheckTimeoutRange');
    }

    if (config.healthCheckRises !== undefined && !isValidHealthCheckRises(config.healthCheckRises)) {
      errors.healthCheckRises = issue('nlbForm.validation.healthCheckRisesRange');
    }

    if (config.healthCheckFalls !== undefined && !isValidHealthCheckFalls(config.healthCheckFalls)) {
      errors.healthCheckFalls = issue('nlbForm.validation.healthCheckFallsRange');
    }

    if (
      config.healthCheckTimeout !== undefined &&
      config.healthCheckInterval !== undefined &&
      config.healthCheckTimeout >= config.healthCheckInterval
    ) {
      errors.healthCheckTimeout = issue('nlbForm.validation.healthTimeoutLtInterval');
    }
  }

  if (config.proxyConnectTimeout >= config.proxyTimeout) {
    errors.proxyConnectTimeout = issue('nlbForm.validation.proxyConnectLtProxy');
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

const HINT_KEYS: Record<string, string> = {
  name: 'nlbForm.hints.name',
  port: 'nlbForm.hints.port',
  host: 'nlbForm.hints.host',
  upstreamPort: 'nlbForm.hints.upstreamPort',
  weight: 'nlbForm.hints.weight',
  maxFails: 'nlbForm.hints.maxFails',
  failTimeout: 'nlbForm.hints.failTimeout',
  maxConns: 'nlbForm.hints.maxConns',
  proxyTimeout: 'nlbForm.hints.proxyTimeout',
  proxyConnectTimeout: 'nlbForm.hints.proxyConnectTimeout',
  healthCheckInterval: 'nlbForm.hints.healthCheckInterval',
  healthCheckTimeout: 'nlbForm.hints.healthCheckTimeout',
};

/** i18n key for hint text, or empty string if unknown field */
export function getValidationHintKey(field: string): string {
  return HINT_KEYS[field] || '';
}

const EXAMPLE_KEYS: Record<string, string> = {
  name: 'nlbForm.examples.name',
  host: 'nlbForm.examples.host',
  port: 'nlbForm.examples.port',
  upstreamPort: 'nlbForm.examples.upstreamPort',
  weight: 'nlbForm.examples.weight',
  maxFails: 'nlbForm.examples.maxFails',
  failTimeout: 'nlbForm.examples.failTimeout',
  maxConns: 'nlbForm.examples.maxConns',
  proxyTimeout: 'nlbForm.examples.proxyTimeout',
  proxyConnectTimeout: 'nlbForm.examples.proxyConnectTimeout',
  healthCheckInterval: 'nlbForm.examples.healthCheckInterval',
  healthCheckTimeout: 'nlbForm.examples.healthCheckTimeout',
};

/** i18n key for placeholder/example, or empty string */
export function getExampleValueKey(field: string): string {
  return EXAMPLE_KEYS[field] || '';
}

export type ConfigWarning = { key: string; values?: Record<string, unknown> };

export function checkConfigurationWarnings(config: {
  upstreams: Array<{
    host: string;
    port: number;
    weight: number;
    maxFails: number;
    failTimeout: number;
    backup: boolean;
    down: boolean;
  }>;
  proxyTimeout: number;
  proxyConnectTimeout: number;
  healthCheckEnabled: boolean;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
}): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];

  const weights = config.upstreams.map(u => u.weight);
  if (new Set(weights).size === 1 && weights[0] !== 1) {
    warnings.push({ key: 'nlbForm.warnings.sameWeight' });
  }

  if (config.proxyTimeout > 300) {
    warnings.push({ key: 'nlbForm.warnings.proxyTimeoutHigh' });
  }

  if (!config.healthCheckEnabled) {
    warnings.push({ key: 'nlbForm.warnings.healthDisabled' });
  }

  if (config.healthCheckEnabled && config.healthCheckInterval && config.healthCheckInterval < 10) {
    warnings.push({ key: 'nlbForm.warnings.healthFrequent' });
  }

  const hasBackup = config.upstreams.some(u => u.backup);
  const hasActive = config.upstreams.some(u => !u.backup && !u.down);
  if (hasBackup && !hasActive) {
    warnings.push({ key: 'nlbForm.warnings.backupOnly' });
  }

  return warnings;
}
