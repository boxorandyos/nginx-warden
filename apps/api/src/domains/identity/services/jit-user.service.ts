import {
  AuthProviderType,
  UserRole,
  Prisma,
} from '@prisma/client';
import prisma from '../../../config/database';
import type { IdpIdentity } from '../identity.types';
import logger from '../../../utils/logger';

/**
 * Create or update a local shadow user from an external IdP identity.
 */
export async function upsertExternalUser(
  providerType: AuthProviderType,
  identity: IdpIdentity
): Promise<{
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: string;
  authProvider: AuthProviderType;
  externalId: string | null;
  externalGroups: string[];
  isFirstLogin: boolean;
  twoFactor: any;
  password: string | null;
  avatar: string | null;
  phone: string | null;
  timezone: string;
  language: string;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  const externalId = identity.externalId || identity.username;
  const role = identity.suggestedRole || UserRole.viewer;

  const existingByExternal = await prisma.user.findFirst({
    where: { authProvider: providerType, externalId },
    include: { twoFactor: true },
  });

  if (existingByExternal) {
    return prisma.user.update({
      where: { id: existingByExternal.id },
      data: {
        email: identity.email,
        fullName: identity.fullName,
        externalGroups: identity.groups,
        // Only elevate/adjust role if still matching provider-managed user
        role,
        status: existingByExternal.status === 'suspended' ? 'suspended' : 'active',
      },
      include: { twoFactor: true },
    });
  }

  // Prefer stable username; on collision append suffix
  let username = identity.username.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'user';
  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken && (taken.authProvider !== providerType || taken.externalId !== externalId)) {
    username = `${username}_${Date.now().toString(36).slice(-4)}`;
  }

  // Email uniqueness
  let email = identity.email;
  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken && emailTaken.externalId !== externalId) {
    email = `${username}.${providerType}@warden.local`;
  }

  try {
    return await prisma.user.create({
      data: {
        username,
        email,
        fullName: identity.fullName,
        password: null,
        role,
        status: 'active',
        authProvider: providerType,
        externalId,
        externalGroups: identity.groups,
        isFirstLogin: false,
      },
      include: { twoFactor: true },
    });
  } catch (e) {
    logger.error('JIT user create failed, retrying find', e);
    const again = await prisma.user.findFirst({
      where: { authProvider: providerType, externalId },
      include: { twoFactor: true },
    });
    if (again) return again;
    throw e;
  }
}
