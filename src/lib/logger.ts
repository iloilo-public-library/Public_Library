export type LogLevel = "info" | "warn" | "error" | "security";

const SENSITIVE_KEY_RE = /(password|secret|token|key|cookie|authorization|credential)/i;

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    clean[k] = SENSITIVE_KEY_RE.test(k) ? "[REDACTED]" : v;
  }
  return clean;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: sanitizeMeta(meta) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn" || level === "security") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
  security: (message: string, meta?: Record<string, unknown>) => emit("security", message, meta),
};
