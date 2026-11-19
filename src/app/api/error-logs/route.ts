import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { recordErrorLog, type ErrorLogLevel } from "@/lib/admin/error-logger";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      level?: ErrorLogLevel;
      source?: string;
      route?: string;
      method?: string;
      status_code?: number;
      message?: string;
      details?: string;
    };

    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 });
    }

    const session = await getServerSession();

    const entry = await recordErrorLog({
      level: body.level === "warning" || body.level === "security" || body.level === "info" ? body.level : "error",
      source: body.source === "404" ? "404" : body.source === "Client" ? "Client" : "Client",
      route: body.route || "/",
      method: body.method || "GET",
      status_code: body.status_code ?? 500,
      message,
      details: body.details || "",
      user_email: session?.email || "anonymous",
    });

    return NextResponse.json({ ok: true, id: entry.id });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
