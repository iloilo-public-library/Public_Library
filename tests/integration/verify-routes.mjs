import { spawn } from "node:child_process";
import http from "node:http";

const PORT = Number(process.env.VERIFY_PORT || 3099);

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method,
        headers: data
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(data),
            }
          : {},
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

const API_CHECKS = [
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

    for (const check of API_CHECKS) {
      const res = await request(check.method, check.path, check.body);
      if (res.status === check.expect) {
        passed++;
      } else {
        failed++;
        console.error(
          `FAIL API ${check.method} ${check.path}: expected ${check.expect}, got ${res.status}`
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
