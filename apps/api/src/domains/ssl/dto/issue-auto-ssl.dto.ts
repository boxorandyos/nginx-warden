/**
 * DTO for automatic SSL certificate issuance using Let's Encrypt/ZeroSSL
 */
export interface IssueAutoSSLDto {
  domainId: string;
  email?: string;
  autoRenew?: boolean;
  /** letsencrypt | zerossl — defaults to system ACME setting */
  acmeProvider?: 'letsencrypt' | 'zerossl' | string;
}
