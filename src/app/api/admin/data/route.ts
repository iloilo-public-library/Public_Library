import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { queryAdminResource } from "@/lib/admin/queries";
import { AdminMutationError, handleAdminMutation } from "@/lib/admin/mutations";
import {
  clearAllErrorLogs,
  deleteErrorLog,
  recordErrorLog,
  toggleResolveErrorLog,
} from "@/lib/admin/error-logger";

const ALLOWED_RESOURCES = new Set([
  "inventory",
  "books",
  "library_cards",
  "returns",
  "users",
  "librarians",
  "admins",
  "account_requests",
  "events",
  "announcements",
  "system_settings",
  "backup_logs",
  "admin_profile",
  "isbn_lookup",
  "error_logs",
]);

async function requireStaffSession() {
  const session = await getServerSession();
  if (!session || (session.role !== "admin" && session.role !== "librarian")) {
    return null;
  }
  return session;
}

async function lookupByIsbn(rawIsbn: string) {
  const isbn = rawIsbn.replace(/[^0-9Xx-]/g, "").trim();
  if (!isbn) return { found: false };

  try {
    const gRes = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`,
      { next: { revalidate: 3600 } }
    );
    if (gRes.ok) {
      const gJson = (await gRes.json()) as {
        items?: {
          volumeInfo?: {
            title?: string;
            subtitle?: string;
            authors?: string[];
            publisher?: string;
            publishedDate?: string;
            description?: string;
            pageCount?: number;
            categories?: string[];
            language?: string;
            imageLinks?: { thumbnail?: string };
          };
        }[];
      };
      const info = gJson.items?.[0]?.volumeInfo;
      if (info?.title) {
        return {
          found: true,
          book: {
            title: info.title,
            subtitle: info.subtitle ?? "",
            author: (info.authors ?? []).join(", "),
            publisher: info.publisher ?? "",
            published_date: info.publishedDate ?? "",
            description: info.description ?? "",
            page_count: info.pageCount ?? "",
            category: info.categories?.[0] ?? "",
            language: (info.language ?? "en").slice(0, 5),
            thumbnail_url: info.imageLinks?.thumbnail?.replace("http://", "https://") ?? "",
            api_source: "Google Books",
          },
        };
      }
    }
  } catch {
    // Fallback to OpenLibrary
  }

  try {
    const olRes = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,
      { next: { revalidate: 3600 } }
    );
    if (olRes.ok) {
      const olJson = (await olRes.json()) as Record<
        string,
        {
          title?: string;
          subtitle?: string;
          authors?: { name: string }[];
          publishers?: { name: string }[];
          publish_date?: string;
          number_of_pages?: number;
          subjects?: { name: string }[];
          cover?: { medium?: string; large?: string };
        }
      >;
      const rec = olJson[`ISBN:${isbn}`];
      if (rec?.title) {
        return {
          found: true,
          book: {
            title: rec.title,
            subtitle: rec.subtitle ?? "",
            author: (rec.authors ?? []).map((a) => a.name).join(", "),
            publisher: rec.publishers?.[0]?.name ?? "",
            published_date: rec.publish_date ?? "",
            description: "",
            page_count: rec.number_of_pages ?? "",
            category: rec.subjects?.[0]?.name ?? "",
            language: "en",
            thumbnail_url: rec.cover?.medium ?? rec.cover?.large ?? "",
            api_source: "Open Library",
          },
        };
      }
    }
  } catch {
    // Not found
  }

  return { found: false };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") || "";

  if (!ALLOWED_RESOURCES.has(resource)) {
    return NextResponse.json({ error: "Invalid resource parameter" }, { status: 400 });
  }

  const publicResources = new Set(["events", "announcements"]);
  const session = await getServerSession();
  const isStaff = Boolean(
    session && (session.role === "admin" || session.role === "librarian")
  );

  if (!publicResources.has(resource) && !isStaff) {
    return NextResponse.json(
      { error: "Unauthorized — please log in as staff." },
      { status: 401 }
    );
  }

  if (resource === "isbn_lookup") {
    const isbn = searchParams.get("isbn") || "";
    const result = await lookupByIsbn(isbn);
    return NextResponse.json(result);
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  try {
    const supabase = createSupabaseServerClient(true);
    const payload = await queryAdminResource(
      supabase,
      resource,
      isStaff && session ? session.userId : null
    );
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database query failed";
    await recordErrorLog({
      level: "error",
      source: "API",
      route: `/api/admin/data?resource=${resource}`,
      method: "GET",
      status_code: 500,
      message,
      details: err instanceof Error ? err.stack || "" : "",
      user_email: session?.email || "",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function processMutationRequest(
  request: Request,
  defaultAction: string
) {
  const session = await requireStaffSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized — please log in as staff." },
      { status: 401 }
    );
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  let resource = "";
  let action = defaultAction;

  try {
    const body = (await request.json()) as {
      resource?: string;
      action?: string;
      id?: string | number | null;
      payload?: Record<string, unknown>;
    };

    resource = (body.resource ?? "").trim();
    if (!ALLOWED_RESOURCES.has(resource)) {
      return NextResponse.json({ error: "Invalid resource parameter" }, { status: 400 });
    }

    action = (body.action ?? defaultAction).trim();
    const payload = body.payload ?? {};
    const supabase = createSupabaseServerClient(true);

    if (resource === "error_logs") {
      if (session.role !== "admin") {
        return NextResponse.json(
          { error: "Only Administrators can manage error logs." },
          { status: 403 }
        );
      }
      if (action === "create" || action === "test") {
        const entry = await recordErrorLog(
          {
            level: (payload.level as "error" | "security" | "warning" | "info") || "error",
            source: String(payload.source || "API"),
            route: String(payload.route || "/admin/error-logs"),
            method: String(payload.method || "POST"),
            status_code: Number(payload.status_code || 500),
            message: String(payload.message || "Simulated admin diagnostic test error"),
            details: String(payload.details || "Triggered manually from Admin Error Logs console."),
            user_email: session.email,
          },
          supabase
        );
        return NextResponse.json({ ok: true, entry });
      }
      if (action === "resolve") {
        if (!body.id) {
          return NextResponse.json({ error: "Log ID is required." }, { status: 400 });
        }
        await toggleResolveErrorLog(supabase, String(body.id), Boolean(payload.resolved));
        return NextResponse.json({ ok: true });
      }
      if (action === "clear") {
        await clearAllErrorLogs(supabase);
        return NextResponse.json({ ok: true });
      }
      if (action === "delete") {
        if (!body.id) {
          return NextResponse.json({ error: "Log ID is required." }, { status: 400 });
        }
        await deleteErrorLog(supabase, String(body.id));
        return NextResponse.json({ ok: true });
      }
    }

    const id = body.id !== undefined && body.id !== null ? Number(body.id) : null;
    const result = await handleAdminMutation(
      supabase,
      session,
      resource,
      action,
      id,
      payload
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AdminMutationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Operation failed";
    await recordErrorLog({
      level: "error",
      source: "API",
      route: `/api/admin/data (${resource}:${action})`,
      method: request.method,
      status_code: 500,
      message,
      details: err instanceof Error ? err.stack || "" : "",
      user_email: session.email,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return processMutationRequest(request, "create");
}

export async function PUT(request: Request) {
  return processMutationRequest(request, "update");
}

export async function DELETE(request: Request) {
  return processMutationRequest(request, "delete");
}
