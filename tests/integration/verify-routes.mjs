import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const PORT = Number(process.env.VERIFY_PORT || 3099);
const SESSION_COOKIE_NAME = "icpl_session";

function loadEnvSecrets() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvSecrets();

function getSigningSecret() {
  return (
    process.env.SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "icpl-dev-fallback-secret-change-me"
  );
}

function makeSignedSessionCookie(role, userId = 999, email = "test@iloilolibrary.gov.ph") {
  const payload = {
    userId,
    role,
    email,
    sessionToken: crypto.randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");
  return `${SESSION_COOKIE_NAME}=${data}.${sig}`;
}

function request(method, path, body = null, cookie = "", rawContentType = "", extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const isRaw = Boolean(rawContentType && typeof body === "string");
    const data = body ? (isRaw ? body : JSON.stringify(body)) : null;
    const headers = { ...extraHeaders };
    if (data) {
      headers["Content-Type"] = isRaw ? rawContentType : "application/json";
      headers["Content-Length"] = Buffer.byteLength(data);
    }
    if (cookie) {
      headers["Cookie"] = cookie;
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method,
        headers,
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => (chunks += c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            location: res.headers.location || "",
            headers: res.headers,
            body: chunks,
          })
        );
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const PUBLIC_PAGES = [
  "/",
  "/browse",
  "/no_user_about",
  "/login",
  "/scan-qr",
  "/maintenance",
  "/reset-password",
  "/reset-pin",
];

const PROTECTED_PAGES = [
  "/dashboard",
  "/admin/home",
  "/admin/books",
  "/admin/inventory",
  "/admin/library-cards",
  "/admin/records-returns",
  "/admin/users",
  "/admin/librarians",
  "/admin/admins",
  "/admin/account-requests",
  "/admin/calendar",
  "/admin/announcements",
  "/admin/error-logs",
  "/admin-settings",
  "/system-settings",
  "/librarian/home",
  "/librarian/dashboard",
  "/librarian/books",
  "/librarian/inventory",
  "/librarian/library-cards",
  "/librarian/records-returns",
  "/librarian/users",
  "/librarian/account-requests",
  "/librarian/announcements",
  "/librarian/calendar",
  "/librarian/settings",
  "/user/home",
  "/user/browse",
  "/user/borrowed",
  "/user/borrow-history",
  "/user/event",
  "/user/notifications",
  "/user/edit_profile",
  "/user/settings",
  "/user/about",
];

const userCookie = makeSignedSessionCookie("user", 73, "juan.delacruz@example.com");
const librarianCookie = makeSignedSessionCookie("librarian", 76, "keiru.tuerto@iloilolibrary.gov.ph");
const adminCookie = makeSignedSessionCookie("admin", 999, "admin@iloilolibrary.gov.ph");

const MULTIPART_BOUNDARY = "----ICPLVerifyBoundary7MA4YWxkTrZu0gW";
const MEMBER_EVENT_BANNER_FORM = [
  `--${MULTIPART_BOUNDARY}`,
  'Content-Disposition: form-data; name="folder"',
  "",
  "event-banners",
  `--${MULTIPART_BOUNDARY}--`,
  "",
].join("\r\n");

function buildSignupMultipartForm(fields, fileSpec) {
  const parts = [];
  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      `--${MULTIPART_BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
        `${val}\r\n`
    );
  }
  if (fileSpec) {
    parts.push(
      `--${MULTIPART_BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="valid_id"; filename="${fileSpec.filename}"\r\n` +
        `Content-Type: ${fileSpec.contentType}\r\n\r\n` +
        `${fileSpec.content}\r\n`
    );
  }
  parts.push(`--${MULTIPART_BOUNDARY}--\r\n`);
  return parts.join("");
}

const VERIFY_TS = Date.now();
const SIGNUP_SPOOFED_VALID_ID_FORM = buildSignupMultipartForm(
  {
    firstname: "Verify",
    lastname: "Spoof",
    email: `verify.spoof.${VERIFY_TS}@example.com`,
    password: "StrongPassword@123",
    confirm_password: "StrongPassword@123",
    gender: "Male",
    age: "22",
    phone: "09171234567",
  },
  {
    filename: "spoof.jpg",
    contentType: "image/jpeg",
    content: "this is plain text masquerading as a jpeg",
  }
);
const SIGNUP_OVERSIZED_VALID_ID_FORM = buildSignupMultipartForm(
  {
    firstname: "Verify",
    lastname: "Oversize",
    email: `verify.oversize.${VERIFY_TS}@example.com`,
    password: "StrongPassword@123",
    confirm_password: "StrongPassword@123",
    gender: "Female",
    age: "24",
    phone: "09171234568",
  },
  {
    filename: "oversized.jpg",
    contentType: "image/jpeg",
    content: "A".repeat(2 * 1024 * 1024 + 128),
  }
);

const API_CHECKS = [
  // Batch 1: Dashboard Stats (401 unauthenticated, 403 member role)
  { method: "GET", path: "/api/dashboard/stats", expect: 401 },
  { method: "GET", path: "/api/dashboard/stats", cookie: userCookie, expect: 403 },

  // Batch 1: Staff Appearance (401 unauthenticated, 403 member role, 400 unknown field)
  { method: "GET", path: "/api/staff/appearance", expect: 401 },
  { method: "GET", path: "/api/staff/appearance", cookie: userCookie, expect: 403 },
  { method: "PUT", path: "/api/staff/appearance", expect: 401 },
  {
    method: "PUT",
    path: "/api/staff/appearance",
    cookie: userCookie,
    body: { theme: "dark", language: "english" },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/staff/appearance",
    cookie: librarianCookie,
    body: { theme: "dark", language: "english", unknownField: 1 },
    expect: 400,
  },

  // Batch 1: Admin Settings / Profile via /api/admin/data (401 unauthenticated, 403 wrong role, 400 validation)
  { method: "GET", path: "/api/admin/data?resource=admin_profile", expect: 401 },
  {
    method: "GET",
    path: "/api/admin/data?resource=admin_profile",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=admins",
    cookie: librarianCookie,
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    body: { resource: "admin_profile", action: "update_profile", payload: {} },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: userCookie,
    body: { resource: "admin_profile", action: "update_profile", payload: {} },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "admins",
      action: "update",
      id: 1,
      payload: {},
    },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "admin_profile",
      action: "update_profile",
      payload: {},
      unknownRootField: true,
    },
    expect: 400,
  },

  // Batch 1: Auth & Session Foundation routes
  { method: "GET", path: "/api/auth/session", expect: 200 },
  { method: "GET", path: "/logout", expect: 307 },
  {
    method: "POST",
    path: "/api/auth/login",
    body: { email: "not-an-email", password: "" },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/login",
    body: { email: "admin@example.com", password: "secret", unexpected: true },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/signup",
    body: {
      firstname: "Test",
      lastname: "Staff",
      email: "staff@example.com",
      password: "StrongPassword@1",
      role: "admin",
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/auth/signup",
    cookie: userCookie,
    body: {
      firstname: "Test",
      lastname: "Staff",
      email: "staff@example.com",
      password: "StrongPassword@1",
      role: "admin",
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/auth/resend-otp",
    body: {},
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/auth/verify-otp",
    body: { otp: "123456" },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/auth/verify-pin",
    body: { pin: "123456" },
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/auth/verify-captcha",
    expect: 200,
  },
  {
    method: "POST",
    path: "/api/auth/verify-captcha",
    body: { token: "short", answer: "1" },
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/check_email?email=invalid",
    expect: 200,
  },
  {
    method: "POST",
    path: "/api/auth/qr",
    body: { action: "confirm", token: "0123456789abcdef0123456789abcdef" },
    expect: 401,
  },

  // Batch 2: Admin / Librarian / User management and Account Requests
  { method: "GET", path: "/api/admin/users", expect: 401 },
  { method: "GET", path: "/api/admin/users", cookie: userCookie, expect: 403 },
  {
    method: "GET",
    path: "/api/admin/users?unknownField=1",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    body: { resource: "users", action: "create", id: null, payload: {} },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: { resource: "users", action: "create", id: null, payload: {} },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "users",
      action: "create",
      id: null,
      payload: {},
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    body: { resource: "account_requests", action: "approve", id: 1, payload: {} },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: { resource: "account_requests", action: "approve", id: 1, payload: {} },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "account_requests",
      action: "approve",
      id: 1,
      payload: {},
      unknownField: true,
    },
    expect: 400,
  },

  // Batch 3 Part 1: Announcements "Send To", User Notifications, and Member Picker
  { method: "GET", path: "/api/user/notifications", expect: 401 },
  {
    method: "PUT",
    path: "/api/user/notifications",
    body: { action: "read_all" },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/user/notifications",
    cookie: userCookie,
    body: { action: "read_all", unknownField: 1 },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/user/notifications",
    cookie: userCookie,
    body: { action: "read", announcement_id: -1 },
    expect: 400,
  },
  { method: "GET", path: "/api/admin/users?mode=picker", expect: 401 },
  {
    method: "GET",
    path: "/api/admin/users?mode=picker",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/users?mode=picker&unknownField=1",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    body: {
      resource: "announcements",
      action: "create",
      id: null,
      payload: { title: "Notice", body: "Message" },
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "announcements",
      action: "create",
      id: null,
      payload: { title: "Notice", body: "Message" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "announcements",
      action: "create",
      id: null,
      payload: { title: "Notice", body: "Message" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    body: {
      resource: "announcements",
      action: "update",
      id: 1,
      payload: { title: "Notice", body: "Message" },
    },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "announcements",
      action: "update",
      id: 1,
      payload: { title: "Notice", body: "Message" },
    },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "announcements",
      action: "update",
      id: 1,
      payload: { title: "Notice", body: "Message", target_user_id: 73 },
      unknownField: true,
    },
    expect: 400,
  },

  // Batch 3 Part 2: Calendar Core, Event Categories, and Cover Upload RBAC / Strict Validation
  {
    method: "POST",
    path: "/api/admin/data",
    body: {
      resource: "events",
      action: "create",
      id: null,
      payload: { title: "Event", event_date: "2026-05-10" },
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "events",
      action: "create",
      id: null,
      payload: { title: "Event", event_date: "2026-05-10" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "events",
      action: "create",
      id: null,
      payload: { title: "Event", event_date: "2026-05-10" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "events",
      action: "reschedule",
      id: 1,
      payload: { event_date: "2026-05-11" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    body: {
      resource: "event_categories",
      action: "create",
      id: null,
      payload: { slug: "kids", name: "Kids", color: "#48c78e" },
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "event_categories",
      action: "create",
      id: null,
      payload: { slug: "kids", name: "Kids", color: "#48c78e" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "event_categories",
      action: "create",
      id: null,
      payload: { slug: "kids", name: "Kids", color: "#48c78e" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "event_categories",
      action: "create",
      id: null,
      payload: { slug: "kids", name: "Kids", color: "#48c78e" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/storage/upload",
    cookie: userCookie,
    body: MEMBER_EVENT_BANNER_FORM,
    contentType: `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
    expect: 403,
  },

  // Batch 3 Part 3: Recurrence DELETE RBAC & strict validation
  {
    method: "DELETE",
    path: "/api/admin/data",
    body: {
      resource: "events",
      action: "delete",
      id: 1,
      payload: { scope: "this", occurrence_date: "2026-06-15" },
    },
    expect: 401,
  },
  {
    method: "DELETE",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "events",
      action: "delete",
      id: 1,
      payload: { scope: "this", occurrence_date: "2026-06-15" },
    },
    expect: 403,
  },
  {
    method: "DELETE",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "events",
      action: "delete",
      id: 1,
      payload: { scope: "invalid_scope" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "events",
      action: "create",
      id: null,
      payload: {
        title: "Recurring",
        event_date: "2026-06-01",
        recurrence: { freq: "weekly", unknownRecField: 1 },
      },
      unknownField: true,
    },
    expect: 400,
  },

  // Existing checks
  { method: "GET", path: "/api/admin/data?resource=books", expect: 401 },
  { method: "GET", path: "/api/admin/data?resource=invalid", expect: 400 },
  { method: "GET", path: "/api/backup", expect: 401 },
  { method: "POST", path: "/api/backup", expect: 401 },
  { method: "POST", path: "/api/storage/upload", expect: 401 },
  { method: "GET", path: "/api/admin/valid-id/1", expect: 401 },
  { method: "GET", path: "/api/user/settings", expect: 401 },
  { method: "PUT", path: "/api/user/settings", expect: 401 },
  {
    method: "POST",
    path: "/api/auth/reset-password",
    body: { action: "request", email: "invalid" },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/reset-pin",
    body: { action: "confirm", token: "short", pin: "123", confirm_pin: "123" },
    expect: 400,
  },
  { method: "GET", path: "/api/auth/qr?token=short", expect: 400 },
  { method: "GET", path: "/cover/not-valid.png", expect: 400 },
  { method: "GET", path: "/cover/events/not-valid.png", expect: 400 },
  { method: "GET", path: "/api/cron/event-reminders", expect: 401 },
  {
    method: "GET",
    path: "/api/cron/event-reminders",
    headers: { Authorization: "Bearer wrong-cron-secret-value" },
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=events&from=2026-01-01&to=2026-12-31",
    expect: 400,
  },

  // Batch 4 Part 1: Books & Inventory RBAC and strict validation
  {
    method: "GET",
    path: "/api/admin/data?resource=books",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=books&unknownFilter=1",
    cookie: adminCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=inventory",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=inventory",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=inventory&pageSize=999",
    cookie: adminCookie,
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    body: {
      resource: "books",
      action: "create",
      id: null,
      payload: { title: "Book", author: "Author", isbn: "978-0-00-000001-1" },
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "books",
      action: "create",
      id: null,
      payload: { title: "Book", author: "Author", isbn: "978-0-00-000001-1" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "books",
      action: "create",
      id: null,
      payload: { title: "Book", author: "Author", isbn: "978-0-00-000001-1" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    body: {
      resource: "inventory",
      action: "retire_copy",
      id: 1,
      payload: { condition: "Destroyed" },
    },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "inventory",
      action: "retire_copy",
      id: 1,
      payload: { condition: "Destroyed" },
    },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "inventory",
      action: "retire_copy",
      id: 1,
      payload: { condition: "Destroyed" },
      unknownField: true,
    },
    expect: 400,
  },

  // Batch 4 Part 2: Circulation (Borrowing, Returns, Renewals, Fines) RBAC & strict validation
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&badParam=1",
    cookie: adminCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=returns",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=returns",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    body: {
      resource: "library_cards",
      action: "create",
      id: null,
      payload: { firstname: "Test", lastname: "User" },
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "library_cards",
      action: "create",
      id: null,
      payload: { firstname: "Test", lastname: "User" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "library_cards",
      action: "waive_fine",
      id: 1,
      payload: { reason: "Trying as librarian" },
    },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "library_cards",
      action: "return_books",
      id: 1,
      payload: { return_date: "2026-05-10" },
      unknownField: true,
    },
    expect: 400,
  },
  // Circulation Integrity: CSV limit, 401/403, and unknown-field 400 checks
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&format=csv",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&format=csv",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&format=json&limit=500",
    cookie: adminCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&format=csv&limit=5001",
    cookie: adminCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=returns&format=csv&unknownParam=1",
    cookie: adminCookie,
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "library_cards",
      action: "create",
      id: null,
      payload: { firstname: "A", lastname: "B" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "library_cards",
      action: "update",
      id: 1,
      payload: { firstname: "A" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "library_cards",
      action: "mark_lost",
      id: 1,
      payload: { reason: "Lost book" },
      unknownField: true,
    },
    expect: 400,
  },
  // Official Circulation Policy: library_holidays & resolve_replacement RBAC + validation
  {
    method: "GET",
    path: "/api/admin/data?resource=library_holidays",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_holidays",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_holidays",
    cookie: librarianCookie,
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    body: {
      resource: "library_holidays",
      action: "create",
      id: null,
      payload: { holiday_date: "2026-12-25", name: "Christmas Day" },
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "library_holidays",
      action: "create",
      id: null,
      payload: { holiday_date: "2026-12-25", name: "Christmas Day" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "library_holidays",
      action: "create",
      id: null,
      payload: { holiday_date: "2026-12-25", name: "Christmas Day" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "library_holidays",
      action: "create",
      id: null,
      payload: { holiday_date: "2026-12-25", name: "Christmas Day" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    body: {
      resource: "library_cards",
      action: "resolve_replacement",
      id: 1,
      payload: { card_book_id: 1, resolution: "replaced", reason: "Replaced copy" },
    },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "library_cards",
      action: "resolve_replacement",
      id: 1,
      payload: { card_book_id: 1, resolution: "replaced", reason: "Replaced copy" },
    },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "library_cards",
      action: "resolve_replacement",
      id: 1,
      payload: { card_book_id: 1, resolution: "waived", reason: "Waive test" },
    },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "library_cards",
      action: "resolve_replacement",
      id: 1,
      payload: { card_book_id: 1, resolution: "replaced", reason: "Replaced copy" },
      unknownField: true,
    },
    expect: 400,
  },
  // Circulation Fines, Payments & Admin-Only Returns Delete checks
  {
    method: "POST",
    path: "/api/admin/data",
    body: {
      resource: "library_cards",
      action: "record_fine_payment",
      id: 1,
      payload: { amount: 25, idempotency_key: "verify-route-pay-001" },
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "library_cards",
      action: "record_fine_payment",
      id: 1,
      payload: { amount: 25, idempotency_key: "verify-route-pay-002" },
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "library_cards",
      action: "record_fine_payment",
      id: 1,
      payload: { amount: 25, idempotency_key: "verify-route-pay-003" },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "DELETE",
    path: "/api/admin/data",
    body: {
      resource: "returns",
      action: "delete",
      id: 1,
      payload: {},
    },
    expect: 401,
  },
  {
    method: "DELETE",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "returns",
      action: "delete",
      id: 1,
      payload: {},
    },
    expect: 403,
  },
  {
    method: "DELETE",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "returns",
      action: "delete",
      id: 1,
      payload: {},
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/user/renew",
    body: { card_id: 1, reason: "Need more time" },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/user/renew",
    cookie: userCookie,
    body: { card_id: 1, reason: "Need more time", unknownField: true },
    expect: 400,
  },

  // Batch 4 Part 3: System Settings & Backups RBAC and strict validation
  {
    method: "GET",
    path: "/api/admin/data?resource=system_settings",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=system_settings",
    cookie: librarianCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=backup_logs",
    cookie: librarianCookie,
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "system_settings",
      action: "toggle_lockdown",
      id: null,
      payload: { enabled: true, confirm: true, reason: "Test" },
    },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "system_settings",
      action: "update",
      id: null,
      payload: { maintenance_enabled: false },
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/backup",
    cookie: librarianCookie,
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/backup",
    cookie: librarianCookie,
    body: { scope: "Full" },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/backup",
    cookie: adminCookie,
    body: { scope: "Full", unknownField: true },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/backup",
    body: { backup_log_id: 1, confirm: "RESTORE" },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/backup",
    cookie: librarianCookie,
    body: { backup_log_id: 1, confirm: "RESTORE" },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/backup",
    cookie: adminCookie,
    body: { backup_log_id: 1, confirm: "NOPE" },
    expect: 400,
  },

  // Book ID identity & optional ISBN route checks
  {
    method: "GET",
    path: "/api/public/books?id=invalid",
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=books&isbn=9780132350884",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=books&isbn=9780132350884",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/user/favorites",
    body: { book_id: 1 },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/user/favorites",
    cookie: userCookie,
    body: { book_id: 1, unknownField: true },
    expect: 400,
  },

  // Librarian Security Hardening: 401, 403, and unknown-field 400 checks
  {
    method: "GET",
    path: "/api/admin/data?resource=librarians",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=librarians",
    cookie: librarianCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=error_logs",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=error_logs",
    cookie: librarianCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=backup_logs",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=isbn_lookup&isbn=9780132350884",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=isbn_lookup&isbn=9780132350884",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=users",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=users",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=users&unknownField=1",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/valid-id/1",
    cookie: librarianCookie,
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "error_logs",
      action: "clear",
      id: null,
      payload: {},
    },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/admin/data",
    cookie: adminCookie,
    body: {
      resource: "error_logs",
      action: "clear",
      id: null,
      payload: {},
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/error-logs",
    body: { message: "Client error", unknownField: true },
    expect: 400,
  },

  // Parity checks: single-card library_cards?id=1, returns?id=1, and admin_profile partial update_profile
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&id=1",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&id=1",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&id=1&unknownField=1",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&id=abc",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=library_cards&id=0",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=returns&id=1",
    expect: 401,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=returns&id=1",
    cookie: userCookie,
    expect: 403,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=returns&id=1&unknownField=1",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=returns&id=abc",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "GET",
    path: "/api/admin/data?resource=returns&id=-1",
    cookie: librarianCookie,
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    body: {
      resource: "admin_profile",
      action: "update_profile",
      payload: { firstname: "Lina" },
    },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: userCookie,
    body: {
      resource: "admin_profile",
      action: "update_profile",
      payload: { firstname: "Lina" },
    },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/admin/data",
    cookie: librarianCookie,
    body: {
      resource: "admin_profile",
      action: "update_profile",
      payload: { firstname: "Lina" },
      unknownField: true,
    },
    expect: 400,
  },

  // Member Security: 401 unauthenticated, 403 wrong role (librarian/admin), 400 unknown/invalid fields
  { method: "GET", path: "/api/user/borrowed-books", expect: 401 },
  { method: "GET", path: "/api/user/borrowed-books", cookie: librarianCookie, expect: 403 },
  { method: "GET", path: "/api/user/borrowed-books", cookie: adminCookie, expect: 403 },

  { method: "GET", path: "/api/user/return-history", expect: 401 },
  { method: "GET", path: "/api/user/return-history", cookie: librarianCookie, expect: 403 },
  { method: "GET", path: "/api/user/return-history", cookie: adminCookie, expect: 403 },

  { method: "POST", path: "/api/user/renew", body: { card_id: 1 }, expect: 401 },
  {
    method: "POST",
    path: "/api/user/renew",
    cookie: librarianCookie,
    body: { card_id: 1 },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/user/renew",
    cookie: userCookie,
    body: { card_id: 1, unknownField: true },
    expect: 400,
  },

  { method: "GET", path: "/api/user/favorites", expect: 401 },
  { method: "GET", path: "/api/user/favorites", cookie: librarianCookie, expect: 403 },
  { method: "POST", path: "/api/user/favorites", body: { book_id: 1 }, expect: 401 },
  {
    method: "POST",
    path: "/api/user/favorites",
    cookie: adminCookie,
    body: { book_id: 1 },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/user/favorites",
    cookie: userCookie,
    body: { book_id: 1, user_id: 999 },
    expect: 400,
  },

  { method: "GET", path: "/api/user/search-history", expect: 401 },
  { method: "GET", path: "/api/user/search-history", cookie: librarianCookie, expect: 403 },
  { method: "POST", path: "/api/user/search-history", body: { query: "test" }, expect: 401 },
  {
    method: "POST",
    path: "/api/user/search-history",
    cookie: librarianCookie,
    body: { query: "test" },
    expect: 403,
  },
  {
    method: "POST",
    path: "/api/user/search-history",
    cookie: userCookie,
    body: { query: "test", extraField: true },
    expect: 400,
  },
  { method: "DELETE", path: "/api/user/search-history", expect: 401 },
  { method: "DELETE", path: "/api/user/search-history", cookie: adminCookie, expect: 403 },

  { method: "GET", path: "/api/user/notifications", expect: 401 },
  { method: "GET", path: "/api/user/notifications", cookie: librarianCookie, expect: 403 },
  {
    method: "PUT",
    path: "/api/user/notifications",
    body: { action: "read_all" },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/user/notifications",
    cookie: adminCookie,
    body: { action: "read_all" },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/user/notifications",
    cookie: userCookie,
    body: { action: "read_all", extraField: true },
    expect: 400,
  },

  { method: "GET", path: "/api/user/settings", expect: 401 },
  { method: "GET", path: "/api/user/settings", cookie: librarianCookie, expect: 403 },
  { method: "GET", path: "/api/user/settings", cookie: adminCookie, expect: 403 },
  {
    method: "PUT",
    path: "/api/user/settings",
    body: { action: "clear_favorites" },
    expect: 401,
  },
  {
    method: "PUT",
    path: "/api/user/settings",
    cookie: librarianCookie,
    body: { action: "clear_favorites" },
    expect: 403,
  },
  {
    method: "PUT",
    path: "/api/user/settings",
    cookie: userCookie,
    body: { action: "update_profile", firstname: "Juan", lastname: "Dela", role: "admin" },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/user/settings",
    cookie: userCookie,
    body: { action: "set_pin", password: "Pass@123", pin: "123456", confirm: "654321" },
    expect: 400,
  },
  {
    method: "PUT",
    path: "/api/user/settings",
    cookie: userCookie,
    body: { action: "set_pin", password: "Pass@123", pin: "123456", confirm: "123456", extra: 1 },
    expect: 400,
  },

  { method: "GET", path: "/api/user/valid-id", expect: 401 },
  { method: "GET", path: "/api/user/valid-id", cookie: librarianCookie, expect: 403 },
  { method: "GET", path: "/api/user/valid-id", cookie: adminCookie, expect: 403 },
  { method: "GET", path: "/api/user/valid-id?id=102", cookie: userCookie, expect: 400 },

  {
    method: "POST",
    path: "/api/auth/signup",
    body: {
      firstname: "Public",
      lastname: "Admin",
      email: "public.admin@example.com",
      password: "Password@123",
      role: "admin",
    },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/auth/signup",
    cookie: userCookie,
    body: {
      firstname: "Member",
      lastname: "Admin",
      email: "member.admin@example.com",
      password: "Password@123",
      role: "librarian",
    },
    expect: 403,
  },

  // Auth Hardening: 401 unauthenticated/cookie-isolation, 403 wrong role, 400 missing captcha or unknown fields
  {
    method: "POST",
    path: "/api/auth/login",
    body: { email: "admin@example.com", password: "Password@123" },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/login",
    body: {
      email: "admin@example.com",
      password: "Password@123",
      captcha_token: "valid-looking-captcha-token-123456",
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/verify-otp",
    cookie: userCookie,
    body: { otp: "123456" },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/auth/verify-otp",
    body: { email: "admin@example.com", otp: "123456" },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/verify-pin",
    cookie: userCookie,
    body: { pin: "123456" },
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/auth/verify-pin",
    body: { email: "admin@example.com", pin: "123456" },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/resend-otp",
    cookie: userCookie,
    body: {},
    expect: 401,
  },
  {
    method: "POST",
    path: "/api/auth/resend-otp",
    body: { email: "admin@example.com" },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/verify-captcha",
    body: { token: "0123456789abcdef", answer: "12", unknownField: 1 },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/reset-password",
    body: { action: "request", email: "user@example.com", unknownField: true },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/reset-pin",
    body: { action: "request", email: "user@example.com", unknownField: true },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/signup",
    cookie: librarianCookie,
    body: {
      firstname: "Lib",
      lastname: "Escalation",
      email: "lib.escalation@example.com",
      password: "Password@123",
      role: "admin",
    },
    expect: 403,
  },

  // Auth Hardening P2: signup decimal age, unknown fields, and multipart spoofed/oversized valid_id
  {
    method: "POST",
    path: "/api/auth/signup",
    body: {
      firstname: "Decimal",
      lastname: "Age",
      email: "decimal.age@example.com",
      password: "StrongPassword@123",
      confirm_password: "StrongPassword@123",
      gender: "Male",
      age: 18.5,
      phone: "09171234567",
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/signup",
    body: {
      firstname: "Unknown",
      lastname: "Field",
      email: "unknown.field@example.com",
      password: "StrongPassword@123",
      confirm_password: "StrongPassword@123",
      gender: "Female",
      age: 20,
      phone: "09171234567",
      unknownField: true,
    },
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/signup",
    body: SIGNUP_SPOOFED_VALID_ID_FORM,
    contentType: `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
    expect: 400,
  },
  {
    method: "POST",
    path: "/api/auth/signup",
    body: SIGNUP_OVERSIZED_VALID_ID_FORM,
    contentType: `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
    expect: 400,
  },
];

async function main() {
  const srv = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT), "-H", "127.0.0.1"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let ready = false;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 15000);
    srv.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Ready") && !ready) {
        ready = true;
        clearTimeout(timer);
        resolve();
      }
    });
    srv.on("exit", (code) => {
      if (!ready) {
        clearTimeout(timer);
        reject(new Error(`Server exited early with code ${code}`));
      }
    });
  });

  let passed = 0;
  let failed = 0;

  try {
    for (const p of PUBLIC_PAGES) {
      const res = await request("GET", p);
      if (res.status === 200) {
        passed++;
      } else {
        failed++;
        console.error(`FAIL PUBLIC ${p}: expected 200, got ${res.status}`);
      }
    }

    for (const p of PROTECTED_PAGES) {
      const res = await request("GET", p);
      if (res.status === 307 && res.location.startsWith("/login?next=")) {
        passed++;
      } else {
        failed++;
        console.error(
          `FAIL PROTECTED ${p}: expected 307 -> /login?next=..., got ${res.status} (${res.location})`
        );
      }
    }

    // Also verify page RBAC in middleware: signed-in member accessing /dashboard or /admin-settings redirects to /user/home
    // and signed-in librarian accessing admin-only /admin-settings redirects to /librarian/dashboard
    const memberOnAdminDash = await request("GET", "/dashboard", null, userCookie);
    if (memberOnAdminDash.status === 307 && memberOnAdminDash.location.endsWith("/user/home")) {
      passed++;
    } else {
      failed++;
      console.error(
        `FAIL RBAC PAGE /dashboard (user): expected 307 -> /user/home, got ${memberOnAdminDash.status} (${memberOnAdminDash.location})`
      );
    }

    const libOnAdminSettings = await request("GET", "/admin-settings", null, librarianCookie);
    if (
      libOnAdminSettings.status === 307 &&
      libOnAdminSettings.location.endsWith("/librarian/dashboard")
    ) {
      passed++;
    } else {
      failed++;
      console.error(
        `FAIL RBAC PAGE /admin-settings (librarian): expected 307 -> /librarian/dashboard, got ${libOnAdminSettings.status} (${libOnAdminSettings.location})`
      );
    }

    const libOnAdminDash = await request("GET", "/dashboard", null, librarianCookie);
    if (
      libOnAdminDash.status === 307 &&
      libOnAdminDash.location.endsWith("/librarian/dashboard")
    ) {
      passed++;
    } else {
      failed++;
      console.error(
        `FAIL RBAC PAGE /dashboard (librarian): expected 307 -> /librarian/dashboard, got ${libOnAdminDash.status} (${libOnAdminDash.location})`
      );
    }

    for (const check of API_CHECKS) {
      const res = await request(
        check.method,
        check.path,
        check.body,
        check.cookie || "",
        check.contentType || "",
        check.headers || {}
      );
      if (res.status === check.expect) {
        passed++;
      } else {
        failed++;
        console.error(
          `FAIL API ${check.method} ${check.path}: expected ${check.expect}, got ${res.status} (${res.body})`
        );
      }
    }

    // Auth Hardening P2: POST /api/auth/qr returns local data:image/svg+xml;base64,... (no external URL)
    const qrRes = await request("POST", "/api/auth/qr", { action: "generate" });
    let qrParsed = null;
    try {
      qrParsed = JSON.parse(qrRes.body);
    } catch {
      qrParsed = null;
    }
    const qrImgUrl = typeof qrParsed?.qr_image_url === "string" ? qrParsed.qr_image_url : "";
    const qrSvgDecoded = qrImgUrl.startsWith("data:image/svg+xml;base64,")
      ? Buffer.from(qrImgUrl.slice("data:image/svg+xml;base64,".length), "base64").toString("utf8")
      : "";
    if (
      qrRes.status === 200 &&
      qrParsed?.ok === true &&
      qrImgUrl.startsWith("data:image/svg+xml;base64,") &&
      !qrImgUrl.includes("api.qrserver.com") &&
      qrSvgDecoded.includes("<svg")
    ) {
      passed++;
    } else {
      failed++;
      console.error(
        `FAIL API POST /api/auth/qr (generate): expected 200 with local SVG data URL, got ${qrRes.status} (${qrRes.body.slice(0, 200)})`
      );
    }

    // Security & Cache-Control: no-store headers on pages, /api/auth/*, and /logout
    const homeRes = await request("GET", "/");
    const requiredSecurityHeaders = [
      ["strict-transport-security", /max-age=/i],
      ["x-frame-options", /^DENY$/i],
      ["x-content-type-options", /^nosniff$/i],
      ["referrer-policy", /strict-origin-when-cross-origin/i],
      ["content-security-policy-report-only", /default-src 'self'/i],
    ];
    for (const [hdrName, pattern] of requiredSecurityHeaders) {
      const val = String(homeRes.headers?.[hdrName] || "");
      if (pattern.test(val)) {
        passed++;
      } else {
        failed++;
        console.error(`FAIL HEADER / ${hdrName}: expected ${pattern}, got "${val}"`);
      }
    }

    for (const noStorePath of ["/api/auth/session", "/logout"]) {
      const res = await request("GET", noStorePath);
      const cc = String(res.headers?.["cache-control"] || "");
      if (/no-store/i.test(cc)) {
        passed++;
      } else {
        failed++;
        console.error(
          `FAIL HEADER ${noStorePath} cache-control: expected no-store, got "${cc}"`
        );
      }
    }
  } finally {
    srv.kill("SIGTERM");
  }

  console.log(`Verification complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
