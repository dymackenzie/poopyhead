export const AVATAR_SLUGS = ['bluffer', 'grandma', 'hothead', 'philosopher', 'poopyhead', 'rookie', 'shark', 'wildcard'] as const;
export type AvatarSlug = typeof AVATAR_SLUGS[number];
export function randomAvatar(): AvatarSlug {
  return AVATAR_SLUGS[Math.floor(Math.random() * AVATAR_SLUGS.length)];
}
export function avatarUrl(slug: string | undefined | null): string {
  if (slug && (AVATAR_SLUGS as readonly string[]).includes(slug)) return `/avatars/${slug}.png`;
  return '/avatars/rookie.png';
}
