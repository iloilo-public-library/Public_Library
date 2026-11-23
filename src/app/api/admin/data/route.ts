import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { isAdminRole, isStaffRole } from "@/lib/auth/rbac";
import {
  AdminMutationError,
  executeAdminMutation,
  getAdminResourceData,
} from "@/services/admin.service";
import { adminMutationSchema, adminQuerySchema } from "@/validators/admin";
import {
  clearAllErrorLogs,
  deleteErrorLog,
  recordErrorLog,
  toggleResolveErrorLog,
} from "@/lib/audit/error-logger";

async function requireStaffSession() {
  const session = await getServerSession();
  if (!session || !isStaffRole(session.role)) {
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
  const parsedQuery = adminQuerySchema.safeParse({
    resource: searchParams.get("resource") || "",
    isbn: searchParams.get("isbn") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid resource parameter" }, { status: 400 });
  }

  const { resource, isbn, from, to } = parsedQuery.data;
  const publicResources = new Set(["events", "event_categories", "announcements"]);
  const session = await getServerSession();
  const isStaff = Boolean(session && isStaffRole(session.role));

  if (!publicResources.has(resource) && !isStaff) {
    return NextResponse.json(
      { error: "Unauthorized — please log in as staff." },
      { status: 401 }
    );
  }

  if (resource === "isbn_lookup") {
    const result = await lookupByIsbn(isbn || "");
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
    const payload = await getAdminResourceData(
      supabase,
      resource,
      isStaff && session ? session.userId : null,
      resource === "events" ? { from, to, isStaff } : undefined
    );
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof AdminMutationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
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
    const rawBody = await request.json();
    const parsedBody = adminMutationSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message || "Invalid request payload" },
        { status: 400 }
      );
    }

    const { resource: validatedResource, id: rawId, payload } = parsedBody.data;
    resource = validatedResource;
    action = (parsedBody.data.action ?? defaultAction).trim();
    const supabase = createSupabaseServerClient(true);

    if (resource === "error_logs") {
      if (!isAdminRole(session.role)) {
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
        if (!rawId) {
          return NextResponse.json({ error: "Log ID is required." }, { status: 400 });
        }
        await toggleResolveErrorLog(supabase, String(rawId), Boolean(payload.resolved));
        return NextResponse.json({ ok: true });
      }
      if (action === "clear") {
        await clearAllErrorLogs(supabase);
        return NextResponse.json({ ok: true });
      }
      if (action === "delete") {
        if (!rawId) {
          return NextResponse.json({ error: "Log ID is required." }, { status: 400 });
        }
        await deleteErrorLog(supabase, String(rawId));
        return NextResponse.json({ ok: true });
      }
    }

    const id = rawId !== null ? Number(rawId) : null;
    const result = await executeAdminMutation(supabase, session, {
      resource: validatedResource,
      action,
      id,
      payload,
      method: request.method,
    });
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
