/**
 * Stamp faces an owner can pick for their card (OwnCard, "Stamp face"). "number" keeps the
 * numbered spaces; every other id is a 24 x 24 stroke icon, drawn faint on an empty space and
 * in the card's text colour on a stamped one. The API and tc.business.stamp_icon allow the same ids.
 */
export const STAMP_ICON_IDS = ['number', 'star', 'heart', 'cup', 'food', 'scissors', 'polish', 'flower', 'bag'] as const;
export type StampIcon = (typeof STAMP_ICON_IDS)[number];

export const STAMP_ICON_PATHS: Record<Exclude<StampIcon, 'number'>, string> = {
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  cup: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11 3.5v2.5M14 3.5v2.5',
  food: 'M7 3v6a2 2 0 0 0 2 2v10M11 3v6a2 2 0 0 1-2 2M9 3v5M16 21V3c2.5 1.5 3 5 3 9h-3',
  scissors: 'M8.5 7a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0zM8.5 17a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0zM8 8.5L19 17M8 15.5L19 7',
  polish: 'M10 3h4v5h-4zM8 8h8l1 3v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8z',
  flower: 'M12 14.5a2.5 2.5 0 1 1 0-5a2.5 2.5 0 1 1 0 5zM12 9.5C10 6 10.5 3.5 12 3.5s2 2.5 0 6M12 14.5c2 3.5 1.5 6 0 6s-2-2.5 0-6M9.5 12C6 14 3.5 13.5 3.5 12s2.5-2 6 0M14.5 12c3.5-2 6-1.5 6 0s-2.5 2-6 0',
  bag: 'M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8',
};

export function isStampIcon(v: unknown): v is StampIcon {
  return typeof v === 'string' && (STAMP_ICON_IDS as readonly string[]).includes(v);
}

/** The path for an icon face, or null for numbered spaces (and for anything unknown). */
export function stampIconPath(icon: string | null | undefined): string | null {
  return icon && icon !== 'number' && icon in STAMP_ICON_PATHS ? STAMP_ICON_PATHS[icon as keyof typeof STAMP_ICON_PATHS] : null;
}
