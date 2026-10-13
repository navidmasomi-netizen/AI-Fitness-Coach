export function getHydratedSupplementOther(profile: { supplementOther?: string | null } | null): string | null {
  return profile?.supplementOther || null;
}
