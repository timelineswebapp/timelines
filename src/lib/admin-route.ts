import "server-only";

const RESERVED_ADMIN_GUESSES = new Set(["admin", "editor", "dashboard"]);
const ADMIN_ROUTE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getAdminRouteSlug(): string | null {
  const slug = process.env.ADMIN_ROUTE_SLUG?.trim() ?? "";

  if (!slug) {
    return null;
  }

  if (!ADMIN_ROUTE_PATTERN.test(slug)) {
    throw new Error("ADMIN_ROUTE_SLUG must contain only lowercase letters, numbers, and hyphens.");
  }

  if (RESERVED_ADMIN_GUESSES.has(slug)) {
    throw new Error("ADMIN_ROUTE_SLUG cannot use a reserved public guess path.");
  }

  return slug;
}

export function getAdminRoutePath(): string | null {
  const slug = getAdminRouteSlug();
  return slug ? `/${slug}` : null;
}
