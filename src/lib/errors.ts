import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status = 500, code = "INTERNAL_ERROR", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message = "Invalid request input.",
    details?: unknown,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized — please log in.") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden — insufficient permissions.") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict.") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSec: number;

  constructor(
    message = "Too many requests. Please wait a moment and try again.",
    retryAfterSec = 60
  ) {
    super(message, 429, "RATE_LIMITED");
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Database service is temporarily unavailable.") {
    super(message, 503, "SERVICE_UNAVAILABLE");
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Formats Zod issues into a field-level error dictionary and friendly primary message.
 */
export function formatZodError(err: ZodError): {
  message: string;
  fieldErrors: Record<string, string[]>;
  issues: Array<{ path: string; message: string; code: string }>;
} {
  const fieldErrors: Record<string, string[]> = {};
  const issues: Array<{ path: string; message: string; code: string }> = [];

  for (const issue of err.issues) {
    const rawPath = issue.path.map(String).join(".");
    const isUnrecognized = issue.code === "unrecognized_keys";
    const unknownKeys =
      isUnrecognized && "keys" in issue && Array.isArray(issue.keys)
        ? issue.keys.map(String)
        : [];
    const pathKey = rawPath || (unknownKeys[0] ?? "input");
    const msg =
      isUnrecognized && unknownKeys.length > 0
        ? `Unknown field(s) not allowed: ${unknownKeys.join(", ")}`
        : issue.message;

    if (!fieldErrors[pathKey]) {
      fieldErrors[pathKey] = [];
    }
    fieldErrors[pathKey].push(msg);
    issues.push({ path: pathKey, message: msg, code: issue.code });
  }

  const first = issues[0];
  const message = first
    ? first.path && first.path !== "input" && !first.message.startsWith("Unknown field")
      ? `${first.message}`
      : first.message
    : "Validation failed.";

  return { message, fieldErrors, issues };
}

/**
 * Maps PostgreSQL / PostgREST error codes (unique, foreign key, check, not-null)
 * into safe, user-friendly AppErrors without leaking raw SQL or table details.
 */
export function mapDatabaseError(
  err: unknown,
  fallbackMessage = "A database operation could not be completed."
): AppError {
  if (err instanceof AppError) return err;

  const rec = (err && typeof err === "object" ? err : {}) as {
    code?: string;
    message?: string;
    details?: string;
  };
  const code = String(rec.code ?? "");
  const rawMessage = String(rec.message ?? "");

  logger.error("Database error encountered", {
    code,
    message: rawMessage.slice(0, 300),
  });

  if (code === "23505" || /duplicate key value violates unique constraint/i.test(rawMessage)) {
    if (/email|username/i.test(rawMessage)) {
      return new ConflictError("An account with this email already exists.");
    }
    if (/isbn/i.test(rawMessage)) {
      return new ConflictError("A book with this ISBN already exists.");
    }
    if (/accession_number/i.test(rawMessage)) {
      return new ConflictError("A book copy with this accession number already exists.");
    }
    return new ConflictError("A record with those details already exists.");
  }

  if (code === "23503" || /violates foreign key constraint/i.test(rawMessage)) {
    return new ConflictError(
      "This record cannot be modified or removed because it is referenced by other library records."
    );
  }

  if (code === "23514" || /violates check constraint/i.test(rawMessage)) {
    return new ValidationError("One or more field values are outside the permitted range.");
  }

  if (code === "23502" || /violates not-null constraint/i.test(rawMessage)) {
    return new ValidationError("A required field is missing.");
  }

  if (code === "PGRST116") {
    return new NotFoundError("The requested record was not found.");
  }

  return new AppError(fallbackMessage, 500, "DATABASE_ERROR");
}

export function toErrorResponse(err: unknown) {
  if (err instanceof ZodError) {
    const formatted = formatZodError(err);
    return NextResponse.json(
      {
        ok: false,
        error: formatted.message,
        code: "VALIDATION_ERROR",
        fieldErrors: formatted.fieldErrors,
        issues: formatted.issues,
      },
      { status: 400 }
    );
  }

  if (err instanceof ValidationError) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code: err.code,
        ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
      },
      { status: err.status }
    );
  }

  if (err instanceof RateLimitError) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code: err.code,
        retryAfter: err.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(err.retryAfterSec) },
      }
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: err.message, code: err.code },
      { status: err.status }
    );
  }

  logger.error("Unhandled route error", {
    error: err instanceof Error ? err.message : String(err),
  });
  return NextResponse.json(
    { ok: false, error: "An unexpected server error occurred.", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

/**
 * Asia/Manila (UTC+8, no DST) date helpers so day boundaries, due dates,
 * and dashboard analytics always align with Philippine local time.
 */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function toManilaDateKey(input: Date | string | number = new Date()): string {
  const ms = input instanceof Date ? input.getTime() : typeof input === "number" ? input : Date.parse(input);
  if (!Number.isFinite(ms)) return "";
  const shifted = new Date(ms + MANILA_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

export function getManilaLastNDays(days = 7, now: Date = new Date()): string[] {
  const shiftedNow = new Date(now.getTime() + MANILA_OFFSET_MS);
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();
  const keys: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month, day - i, 0, 0, 0, 0));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function formatManilaDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00+08:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}
