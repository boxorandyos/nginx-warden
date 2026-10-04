import { AuthProviderType } from '@prisma/client';
import { comparePassword } from '../../../utils/password';
import prisma from '../../../config/database';
import type {
  IdpAuthenticateInput,
  IdpAuthenticateResult,
  IdentityProvider,
} from '../identity.types';

/**
 * Local username/password IdP — default for admin portal.
 */
export class LocalIdentityProvider implements IdentityProvider {
  readonly type = AuthProviderType.local;

  async authenticate(input: IdpAuthenticateInput): Promise<IdpAuthenticateResult> {
    const user = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (!user || user.authProvider !== AuthProviderType.local) {
      return { ok: false, reason: 'Invalid credentials' };
    }

    if (!user.password) {
      return { ok: false, reason: 'Invalid credentials' };
    }

    const valid = await comparePassword(input.password, user.password);
    if (!valid) {
      return { ok: false, reason: 'Invalid credentials' };
    }

    return {
      ok: true,
      identity: {
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        externalId: user.id,
        groups: [],
        suggestedRole: user.role,
      },
    };
  }
}
