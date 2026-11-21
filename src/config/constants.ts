export const ROLES = ["admin", "librarian", "user"] as const;
export type UserRole = (typeof ROLES)[number];

export const STAFF_ROLES: readonly UserRole[] = ["admin", "librarian"] as const;
export const ADMIN_ONLY_ROLES: readonly UserRole[] = ["admin"] as const;

export const SESSION_COOKIE_NAME = "icpl_session";
export const SESSION_MAX_AGE_SEC = 3600;

export const PUBLIC_ROUTES = [
  "/",
  "/browse",
  "/no_user_about",
  "/login",
  "/scan-qr",
  "/maintenance",
  "/reset-password",
  "/reset-pin",
] as const;

export const STAFF_ROUTE_PREFIXES = [
  "/dashboard",
  "/admin",
  "/admin-settings",
  "/system-settings",
  "/librarian",
] as const;

export const ADMIN_ONLY_ROUTE_PREFIXES = [
  "/admin",
  "/admin-settings",
  "/system-settings",
] as const;

export const USER_ROUTE_PREFIXES = ["/user"] as const;
