import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { safeDecryptEmail } from "@/lib/crypto/fernet";

export type ErrorLogLevel = "error" | "security" | "warning" | "info";
export type ErrorLogSource = "API" | "Auth" | "Client" | "Backup" | "Database" | "404";

export interface ErrorLogEntry {
  id: string;
  level: ErrorLogLevel;
  source: ErrorLogSource | string;
  route: string;
  method: string;
  status_code: number;
  message: string;
  details: string;
  user_email: string;
  resolved: boolean;
  created_at: string;
  persistent?: boolean;
}

export interface NewErrorLogInput {
  level?: ErrorLogLevel;
  source?: ErrorLogSource | string;
  route?: string;
  method?: string;
  status_code?: number;
  message: string;
  details?: string;
  user_email?: string;
}

interface GlobalWithLogs {
  __icplErrorLogs?: ErrorLogEntry[];
  __icplResolvedIds?: Set<string>;
  __icplDeletedIds?: Set<string>;
}

const g = globalThis as unknown as GlobalWithLogs;

function getMemStore(): ErrorLogEntry[] {
  if (!g.__icplErrorLogs) {
    g.__icplErrorLogs = [];
  }
  return g.__icplErrorLogs;
}

function getResolvedSet(): Set<string> {
  if (!g.__icplResolvedIds) {
    g.__icplResolvedIds = new Set<string>();
  }
  return g.__icplResolvedIds;
}

function getDeletedSet(): Set<string> {
  if (!g.__icplDeletedIds) {
    g.__icplDeletedIds = new Set<string>();
  }
  return g.__icplDeletedIds;
}

function makeRefId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export async function recordErrorLog(
  input: NewErrorLogInput,
  existingClient?: SupabaseClient
): Promise<ErrorLogEntry> {
  const nowIso = new Date().toISOString();
  const level: ErrorLogLevel = input.level ?? "error";
  const source = (input.source ?? "API").slice(0, 40);
  const route = (input.route ?? "/").slice(0, 255);
  const method = (input.method ?? "GET").toUpperCase().slice(0, 12);
  const statusCode = Number(input.status_code ?? 500) || 500;
  const message = (input.message || "Unhandled error").slice(0, 2000);
  const details = (input.details ?? "").slice(0, 8000);
  const userEmail = (input.user_email ?? "").slice(0, 255);

  const memEntry: ErrorLogEntry = {
    id: makeRefId(),
    level,
    source,
    route,
    method,
    status_code: statusCode,
    message,
    details,
    user_email: userEmail,
    resolved: false,
    created_at: nowIso,
    persistent: false,
  };

  try {
    const supabase =
      existingClient ?? (getSupabaseSecretKey() ? createSupabaseServerClient(true) : null);

    if (supabase) {
      const { data, error } = await supabase
        .from("error_logs")
        .insert({
          level,
          source,
          route,
          method,
          status_code: statusCode,
          message,
          details,
          user_email: userEmail,
          resolved: false,
        })
        .select("id, created_at")
        .single();

      if (!error && data) {
        return {
          ...memEntry,
          id: `db-${data.id}`,
          created_at: String(data.created_at ?? nowIso),
          persistent: true,
        };
      }
    }
  } catch {
    // Fall back silently to memory store if error_logs table is not yet migrated
  }

  const store = getMemStore();
  store.unshift(memEntry);
  if (store.length > 200) {
    store.length = 200;
  }
  return memEntry;
}

export async function listErrorLogs(supabase: SupabaseClient): Promise<ErrorLogEntry[]> {
  const deleted = getDeletedSet();
  const resolvedMem = getResolvedSet();
  const collected: ErrorLogEntry[] = [];

  // 1. Query persistent public.error_logs table if created
  const dbRes = await supabase
    .from("error_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!dbRes.error && dbRes.data) {
    for (const r of dbRes.data) {
      collected.push({
        id: `db-${r.id}`,
        level: (r.level as ErrorLogLevel) || "error",
        source: String(r.source ?? "API"),
        route: String(r.route ?? ""),
        method: String(r.method ?? "GET"),
        status_code: Number(r.status_code ?? 500),
        message: String(r.message ?? ""),
        details: String(r.details ?? ""),
        user_email: String(r.user_email ?? ""),
        resolved: Boolean(r.resolved),
        created_at: String(r.created_at ?? ""),
        persistent: true,
      });
    }
  }

  // 2. Aggregate failed backups from public.backup_logs
  const backupRes = await supabase
    .from("backup_logs")
    .select("id, backup_type, scope, file_name, status, error_message, created_at")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!backupRes.error && backupRes.data) {
    for (const b of backupRes.data) {
      const id = `backup-${b.id}`;
      if (deleted.has(id)) continue;
      collected.push({
        id,
        level: "error",
        source: "Backup",
        route: "/system-settings",
        method: "CRON",
        status_code: 500,
        message: `Backup failed (${b.backup_type}): ${b.error_message || b.file_name || "Unknown error"}`,
        details: `Scope: ${b.scope || "—"} | Archive: ${b.file_name || "—"}`,
        user_email: "system",
        resolved: resolvedMem.has(id),
        created_at: String(b.created_at ?? ""),
        persistent: false,
      });
    }
  }

  // 3. Aggregate account lockouts & failed login attempts from public.users
  const secRes = await supabase
    .from("users")
    .select("id, username, email_display, role, failed_attempts, is_locked, lock_until, last_seen, created_at")
    .or("is_locked.eq.true,failed_attempts.gt.0")
    .order("id", { ascending: false })
    .limit(50);

  if (!secRes.error && secRes.data) {
    for (const u of secRes.data) {
      const id = `auth-lock-${u.id}`;
      if (deleted.has(id)) continue;
      const email = safeDecryptEmail(u.email_display) || String(u.username ?? "");
      const displayEmail = email.startsWith("gAAAAAB") ? `user#${u.id}` : email;
      collected.push({
        id,
        level: u.is_locked ? "security" : "warning",
        source: "Auth",
        route: "/api/auth/login",
        method: "POST",
        status_code: u.is_locked ? 423 : 401,
        message: u.is_locked
          ? `Account locked after ${u.failed_attempts} failed attempts (${displayEmail})`
          : `${u.failed_attempts} failed login attempt(s) recorded (${displayEmail})`,
        details: `User ID: ${u.id} | Role: ${u.role}${u.lock_until ? ` | Lock until: ${u.lock_until}` : ""}`,
        user_email: displayEmail,
        resolved: resolvedMem.has(id),
        created_at: String(u.lock_until ?? u.last_seen ?? u.created_at ?? ""),
        persistent: false,
      });
    }
  }

  // 4. Include runtime in-memory captured events
  for (const m of getMemStore()) {
    if (!deleted.has(m.id)) {
      collected.push(m);
    }
  }

  collected.sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""));
  return collected;
}

export async function toggleResolveErrorLog(
  supabase: SupabaseClient,
  rawId: string,
  resolved: boolean
): Promise<void> {
  if (rawId.startsWith("db-")) {
    const numId = Number(rawId.slice(3));
    if (!Number.isNaN(numId)) {
      await supabase.from("error_logs").update({ resolved }).eq("id", numId);
      return;
    }
  }

  const mem = getMemStore().find((e) => e.id === rawId);
  if (mem) {
    mem.resolved = resolved;
  } else {
    const resolvedMem = getResolvedSet();
    if (resolved) resolvedMem.add(rawId);
    else resolvedMem.delete(rawId);
  }
}

export async function deleteErrorLog(
  supabase: SupabaseClient,
  rawId: string
): Promise<void> {
  if (rawId.startsWith("db-")) {
    const numId = Number(rawId.slice(3));
    if (!Number.isNaN(numId)) {
      await supabase.from("error_logs").delete().eq("id", numId);
      return;
    }
  }

  const store = getMemStore();
  const idx = store.findIndex((e) => e.id === rawId);
  if (idx !== -1) {
    store.splice(idx, 1);
  }
  getDeletedSet().add(rawId);
}

export async function clearAllErrorLogs(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.from("error_logs").delete().neq("id", 0);
  } catch {
    // Ignore if error_logs table doesn't exist yet
  }
  getMemStore().length = 0;
  getDeletedSet().clear();
  getResolvedSet().clear();
}
