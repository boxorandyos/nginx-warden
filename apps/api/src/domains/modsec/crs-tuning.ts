/**
 * Production-usable OWASP CRS defaults for Nginx Warden.
 *
 * Default CRS (paranoia 1 + inbound anomaly threshold 5) blocks on a *single*
 * matching PL1 rule. That is too harsh for WordPress, JSON APIs, and admin
 * logins, so operators fall back to DetectionOnly.
 *
 * These overlays keep blocking mode (SecRuleEngine On) but:
 *  - pin paranoia to 1
 *  - raise inbound/outbound anomaly thresholds
 *  - allow common HTTP methods and JSON content types
 *  - remove a small set of notorious false-positive rule IDs
 *
 * Applied by ModSecSetupService on API startup so existing installs pick it up.
 */

export const WARDEN_CRS_SETUP_FILENAME = 'warden-crs-setup.conf';
export const WARDEN_CRS_EXCLUSIONS_FILENAME = 'warden-crs-exclusions.conf';

/** Inbound score needed to block. CRS default is 5 (one PL1 critical rule). */
export const WARDEN_INBOUND_ANOMALY_THRESHOLD = 10;
/** Outbound score needed to block. CRS default is 4. */
export const WARDEN_OUTBOUND_ANOMALY_THRESHOLD = 8;
export const WARDEN_PARANOIA_LEVEL = 1;

/**
 * Protocol / policy rules that commonly false-positive on WordPress, SPAs,
 * mobile clients, and JSON APIs. Attack-class rules (SQLi/XSS/RCE/LFI) stay on.
 */
export const WARDEN_FALSE_POSITIVE_RULE_IDS = [
  920230, // Multiple URL encoding (WordPress, some CDNs)
  920270, // Invalid character in request (UTF-8 / encoded bodies)
  920300, // Request missing Accept header (APIs, health checks, curl)
  920340, // Request has no Content-Type (empty POST / some clients)
  920350, // Host header is an IP address (internal probes)
  920440, // URL file extension is restricted by policy
] as const;

export function buildWardenCrsSetupConf(): string {
  return `# Nginx Warden CRS setup overlay
# Managed by Nginx Warden — DO NOT EDIT MANUALLY
# Included after coreruleset/crs-setup.conf and before rules/*.conf

# Pin paranoia to 1 (PL2+ rules stay loaded but do not execute)
SecAction \\
 "id:1999000,\\
  phase:1,\\
  nolog,\\
  pass,\\
  t:none,\\
  setvar:tx.blocking_paranoia_level=${WARDEN_PARANOIA_LEVEL}"

SecAction \\
 "id:1999001,\\
  phase:1,\\
  nolog,\\
  pass,\\
  t:none,\\
  setvar:tx.detection_paranoia_level=${WARDEN_PARANOIA_LEVEL}"

# Require multiple signals before blocking (default CRS inbound threshold is 5)
SecAction \\
 "id:1999010,\\
  phase:1,\\
  nolog,\\
  pass,\\
  t:none,\\
  setvar:tx.inbound_anomaly_score_threshold=${WARDEN_INBOUND_ANOMALY_THRESHOLD}"

SecAction \\
 "id:1999011,\\
  phase:1,\\
  nolog,\\
  pass,\\
  t:none,\\
  setvar:tx.outbound_anomaly_score_threshold=${WARDEN_OUTBOUND_ANOMALY_THRESHOLD}"

# REST / WordPress / admin: PUT PATCH DELETE plus JSON content types
SecAction \\
 "id:1999020,\\
  phase:1,\\
  nolog,\\
  pass,\\
  t:none,\\
  setvar:'tx.allowed_methods=GET HEAD POST OPTIONS PUT PATCH DELETE'"

SecAction \\
 "id:1999021,\\
  phase:1,\\
  nolog,\\
  pass,\\
  t:none,\\
  setvar:'tx.allowed_request_content_type=|application/x-www-form-urlencoded| |multipart/form-data| |text/xml| |application/xml| |application/soap+xml| |application/json| |application/octet-stream| |application/csp-report| |application/xss-auditor-report| |text/plain|'"
`;
}

export function buildWardenCrsExclusionsConf(): string {
  const removals = WARDEN_FALSE_POSITIVE_RULE_IDS.map(
    (id) => `SecRuleRemoveById ${id}`
  ).join('\n');

  return `# Nginx Warden CRS false-positive exclusions
# Managed by Nginx Warden — DO NOT EDIT MANUALLY
# Included after coreruleset/rules/*.conf

# Keep blocking mode usable: drop notorious protocol-policy FPs, not attack rules.
${removals}
`;
}

export const WARDEN_MAIN_CONF_INCLUDES = {
  setup: `Include /etc/nginx/modsec/${WARDEN_CRS_SETUP_FILENAME}`,
  exclusions: `Include /etc/nginx/modsec/${WARDEN_CRS_EXCLUSIONS_FILENAME}`,
} as const;
