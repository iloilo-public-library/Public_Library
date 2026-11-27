import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { recordErrorLog, type ErrorLogLevel } from "@/lib/audit/error-logger";
import { toErrorResponse } from "@/lib/errors";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";

const clientErrorLogSchema = z
  .object({
    level: z.enum(["error", "warning", "security", "info"]).optional().default("error"),
    source: z.enum(["Client", "404"]).optional().default("Client"),
    route: z.string().trim().max(240).optional().default("/"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional().default("GET"),
    status_code: z.coerce.number().int().min(100).max(599).optional().default(500),
    message: z.string().trim().min(1, "Message is required.").max(1000),
    details: z.string().trim().max(4000).optional().default(""),
  })
  .strict();

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
    }

    const parsed = clientErrorLogSchema.safeParse(rawBody);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const supabase = getSupabaseSecretKey() ? createSupabaseServerClient(true) : null;
    await enforceRateLimit(
      {
        scope: "client:error-logs",
        identifier: getClientIp(request),
        maxAttempts: 30,
        windowSeconds: 60,
        blockSeconds: 60,
      },
      supabase
    );

    const session = await getServerSession();
    const requestedLevel = parsed.data.level;
    // Prevent unauthenticated / non-admin callers from forging "security" alert logs
    const safeLevel: ErrorLogLevel =
      requestedLevel === "security" && session?.role !== "admin"
        ? "warning"
        : requestedLevel;

    const entry = await recordErrorLog(
      {
        level: safeLevel,
        source: parsed.data.source,
        route: parsed.data.route,
        method: parsed.data.method,
        status_code: parsed.data.status_code,
        message: parsed.data.message,
        details: parsed.data.details,
        user_email: session ? `user#${session.userId}` : "anonymous",
      },
      supabase ?? undefined
    );

    return NextResponse.json({ ok: true, id: entry.id });
  } catch (err) {
    return toErrorResponse(err);
  }
}
