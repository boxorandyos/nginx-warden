import type { UserProfile } from '@/types';

type NameFields = Pick<UserProfile, 'fullName' | 'username'>;

/**
 * Two-letter initials for avatar fallbacks when no photo URL is available.
 */
export function getUserAvatarInitials(user: NameFields | null | undefined): string {
  if (!user) return '?';
  const full = user.fullName?.trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0]!;
      const last = parts[parts.length - 1]!;
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }
    return full.slice(0, 2).toUpperCase();
  }
  const u = user.username?.trim();
  if (u) return u.slice(0, 2).toUpperCase();
  return '?';
}
