import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
  constructor(message = "Invalid request input.", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
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

export function toErrorResponse(err: unknown) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const message = first
      ? `${first.path.join(".") || "input"}: ${first.message}`
      : "Validation failed.";
    return NextResponse.json(
      { ok: false, error: message, code: "VALIDATION_ERROR", issues: err.issues },
      { status: 400 }
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: err.message, code: err.code },
      { status: err.status }
    );
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ ok: false, error: message, code: "INTERNAL_ERROR" }, { status: 500 });
}
