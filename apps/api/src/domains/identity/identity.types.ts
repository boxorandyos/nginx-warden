import type { AuthProviderType, AuthRequirementTarget, UserRole } from '@prisma/client';

export interface IdpAuthenticateInput {
  username: string;
  password: string;
  /** Optional hint when UI selects a specific IdP */
  providerId?: string;
}

export interface IdpIdentity {
  /** Local username to use / JIT */
  username: string;
  email: string;
  fullName: string;
  externalId?: string;
  groups: string[];
  /** Suggested role from group mapping (optional) */
  suggestedRole?: UserRole;
}

export type IdpAuthenticateResult =
  | { ok: true; identity: IdpIdentity }
  | { ok: false; reason: string };

export interface IdentityProvider {
  readonly type: AuthProviderType;
  authenticate(input: IdpAuthenticateInput): Promise<IdpAuthenticateResult>;
}

export interface PolicyEvaluationContext {
  target: AuthRequirementTarget;
  domainId?: string | null;
  groups: string[];
}

export interface ResolvedAuthPolicy {
  id: string;
  slug: string;
  name: string;
  target: AuthRequirementTarget;
  domainId: string | null;
  requireMfa: boolean;
  groupAllow: string[];
  groupDeny: string[];
  sessionTtlMinutes: number | null;
  allowedProviderIds: string[];
  allowedProviderTypes: AuthProviderType[];
}
