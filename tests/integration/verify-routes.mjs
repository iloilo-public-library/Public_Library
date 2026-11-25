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

function request(method, path, body = null, cookie = "") {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers["Content-Type"] = "application/json";
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
    path: "/api/admin/data?resource=events&from=2026-01-01&to=2026-12-31",
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

    for (const check of API_CHECKS) {
      const res = await request(check.method, check.path, check.body, check.cookie || "");
      if (res.status === check.expect) {
        passed++;
      } else {
        failed++;
        console.error(
          `FAIL API ${check.method} ${check.path}: expected ${check.expect}, got ${res.status} (${res.body})`
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
