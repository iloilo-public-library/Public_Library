import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import {
  isAdminRole,
  isStaffRole,
  requireStaff,
  touchSessionActivity,
  verifyRepositoryActor,
} from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { AppError, toErrorResponse } from "@/lib/errors";
import {
  AdminMutationError,
  executeAdminMutation,
  getAdminResourceData,
} from "@/services/admin.service";
import { adminMutationSchema, adminQuerySchema } from "@/validators/admin";
import { buildBorrowHistoryCsv } from "@/lib/circulation/rules";
import {
  clearAllErrorLogs,
  deleteErrorLog,
  recordErrorLog,
  toggleResolveErrorLog,
} from "@/lib/audit/error-logger";

const NOISY_SUBJECT_RE =
  /^(accessible book|protected daisy|in library|overdrive|large type|open library|lending library|internet archive|reading level|nyt:|series:|place:|time:|person:|award:|collection:|ddc:|lcc:|bisac:|dewey )/i;

const GENRE_KEYWORDS: Array<{ match: RegExp; genre: string; category: string }> = [
  { match: /\b(fantasy|magic|wizards|hogwarts|dragons)\b/i, genre: "Fantasy", category: "Fantasy & Young Adult" },
  { match: /\b(cybersecurity|information security|network security|cryptography|hacking)\b/i, genre: "Cybersecurity", category: "Computer Science & IT" },
  { match: /\b(computer|programming|software|algorithm|database|artificial intelligence|data science)\b/i, genre: "Computer Science", category: "Computer Science & IT" },
  { match: /\b(mystery|detective|crime|thriller|suspense|sherlock)\b/i, genre: "Mystery", category: "Mystery & Detective" },
  { match: /\b(romance|love stories)\b/i, genre: "Romance", category: "Contemporary Fiction" },
  { match: /\b(science fiction|sci-fi|dystopian|space opera)\b/i, genre: "Science Fiction", category: "Fiction & Literature" },
  { match: /\b(historical fiction)\b/i, genre: "Historical Fiction", category: "Fiction & Literature" },
  { match: /\b(philippine|filipino|tagalog|rizal|iloilo)\b/i, genre: "Philippine Literature", category: "Philippine Literature" },
  { match: /\b(biography|autobiography|memoir)\b/i, genre: "Biography", category: "Biography & History" },
  { match: /\b(history|historical|civilization|war)\b/i, genre: "History", category: "Biography & History" },
  { match: /\b(philosophy|ethics|stoicism|metaphysics|justice)\b/i, genre: "Philosophy", category: "Philosophy & Ethics" },
  { match: /\b(adventure|travel|pilgrimage|explorers)\b/i, genre: "Adventure", category: "Fiction & Literature" },
  { match: /\b(classic|classics|19th century|shakespeare)\b/i, genre: "Classics", category: "Classic Literature" },
  { match: /\b(poetry|poems)\b/i, genre: "Poetry", category: "Fiction & Literature" },
  { match: /\b(young adult|juvenile fiction|children's stories|children)\b/i, genre: "Young Adult Fiction", category: "Fantasy & Young Adult" },
  { match: /\b(science|physics|chemistry|biology|mathematics|astronomy|medicine)\b/i, genre: "Science", category: "Science & Technology" },
  { match: /\b(fiction|novels|stories)\b/i, genre: "Fiction", category: "Fiction & Literature" },
];

function cleanSubjectTokens(rawList: string[]): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const raw of rawList) {
    if (!raw) continue;
    const parts = raw
      .split(/[\/—]|--/)
      .map((p) => p.replace(/_/g, " ").trim())
      .filter(Boolean);

    for (const part of parts) {
      if (part.includes(":") || NOISY_SUBJECT_RE.test(part)) continue;
      if (part.length < 2 || part.length > 70) continue;
      const key = part.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tokens.push(part);
      }
    }
  }
  return tokens;
}

function resolveCategoryAndGenre(
  rawSubjects: string[],
  title = "",
  description = ""
): { category: string; genre: string } {
  const tokens = cleanSubjectTokens(rawSubjects);
  const combinedHaystack = `${tokens.join(" | ")} ${title} ${description}`;

  let matchedCategory = "";
  let matchedGenre = "";

  for (const rule of GENRE_KEYWORDS) {
    if (rule.match.test(combinedHaystack)) {
      if (!matchedGenre) matchedGenre = rule.genre;
      if (!matchedCategory) matchedCategory = rule.category;
      break;
    }
  }

  const primaryToken = tokens[0] || "";
  const secondaryToken =
    tokens.find((t) => t.toLowerCase() !== primaryToken.toLowerCase()) || "";

  const category = matchedCategory || primaryToken || "General Reference";
  const genre =
    matchedGenre ||
    secondaryToken ||
    primaryToken ||
    "General";

  return { category, genre };
}

async function lookupByIsbn(rawIsbn: string) {
  const cleanDigits = rawIsbn.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (!cleanDigits) return { found: false };

  let gBook: {
    title: string;
    subtitle: string;
    author: string;
    publisher: string;
    published_date: string;
    description: string;
    page_count: number | string;
    subjects: string[];
    language: string;
    thumbnail_url: string;
  } | null = null;

  let olBook: {
    title: string;
    subtitle: string;
    author: string;
    publisher: string;
    published_date: string;
    description: string;
    page_count: number | string;
    subjects: string[];
    thumbnail_url: string;
  } | null = null;

  try {
    const gRes = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanDigits)}`,
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
            imageLinks?: { thumbnail?: string; smallThumbnail?: string };
            industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
          };
        }[];
      };
      const items = gJson.items ?? [];
      const exactItem =
        items.find((it) =>
          (it.volumeInfo?.industryIdentifiers ?? []).some(
            (id) => (id.identifier || "").replace(/[^0-9Xx]/g, "").toUpperCase() === cleanDigits
          )
        ) ?? items[0];
      const info = exactItem?.volumeInfo;
      if (info?.title) {
        gBook = {
          title: info.title,
          subtitle: info.subtitle ?? "",
          author: (info.authors ?? []).join(", "),
          publisher: info.publisher ?? "",
          published_date: info.publishedDate ?? "",
          description: info.description ?? "",
          page_count: info.pageCount ?? "",
          subjects: info.categories ?? [],
          language: (info.language ?? "en").slice(0, 5),
          thumbnail_url:
            (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "").replace(
              "http://",
              "https://"
            ),
        };
      }
    }
  } catch {
    // Continue to Open Library
  }

  try {
    const olRes = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(cleanDigits)}&format=json&jscmd=data`,
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
          subjects?: Array<{ name?: string } | string>;
          notes?: string | { value?: string };
          cover?: { medium?: string; large?: string };
        }
      >;
      const rec = olJson[`ISBN:${cleanDigits}`];
      if (rec?.title) {
        const subjects = (rec.subjects ?? [])
          .map((s) => (typeof s === "string" ? s : s?.name ?? ""))
          .filter(Boolean);
        const notes =
          typeof rec.notes === "string"
            ? rec.notes
            : typeof rec.notes?.value === "string"
              ? rec.notes.value
              : "";
        olBook = {
          title: rec.title,
          subtitle: rec.subtitle ?? "",
          author: (rec.authors ?? []).map((a) => a.name).join(", "),
          publisher: rec.publishers?.[0]?.name ?? "",
          published_date: rec.publish_date ?? "",
          description: notes,
          page_count: rec.number_of_pages ?? "",
          subjects,
          thumbnail_url: rec.cover?.medium ?? rec.cover?.large ?? "",
        };
      }
    }
  } catch {
    // Ignore Open Library network error if Google Books succeeded
  }

  if (!gBook && !olBook) {
    return { found: false };
  }

  const title = gBook?.title || olBook?.title || "";
  const subtitle = gBook?.subtitle || olBook?.subtitle || "";
  const author = gBook?.author || olBook?.author || "";
  const publisher = gBook?.publisher || olBook?.publisher || "";
  const publishedDate = gBook?.published_date || olBook?.published_date || "";
  const description = gBook?.description || olBook?.description || "";
  const pageCount = gBook?.page_count || olBook?.page_count || "";
  const language = gBook?.language || "en";
  const thumbnailUrl = gBook?.thumbnail_url || olBook?.thumbnail_url || "";
  const mergedSubjects = [...(gBook?.subjects ?? []), ...(olBook?.subjects ?? [])];
  const { category, genre } = resolveCategoryAndGenre(mergedSubjects, title, description);

  return {
    found: true,
    book: {
      title,
      subtitle,
      author,
      publisher,
      published_date: publishedDate,
      description,
      page_count: pageCount,
      category,
      class: genre,
      genre,
      language,
      thumbnail_url: thumbnailUrl,
      api_source: gBook && olBook ? "Google Books + Open Library" : gBook ? "Google Books" : "Open Library",
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsedQuery = adminQuerySchema.safeParse({
    ...queryObj,
    resource: searchParams.get("resource") || "",
  });

  if (!parsedQuery.success) {
    return toErrorResponse(parsedQuery.error);
  }

  const {
    resource,
    id,
    isbn,
    from,
    to,
    page,
    limit,
    pageSize,
    q,
    status,
    category,
    condition,
    available,
    damaged,
    overdue,
    format,
    sort,
    order,
  } = parsedQuery.data;
  const publicResources = new Set(["events", "event_categories", "announcements"]);
  const session = await getServerSession();
  const isStaff = Boolean(session && isStaffRole(session.role));

  if (session) {
    void touchSessionActivity(session);
  }

  if (!publicResources.has(resource)) {
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized — please log in as staff." },
        { status: 401 }
      );
    }
    if (!isStaff) {
      return NextResponse.json(
        { ok: false, error: "Forbidden — staff access required." },
        { status: 403 }
      );
    }
  }

  const adminOnlyReadResources = new Set([
    "admins",
    "librarians",
    "system_settings",
    "error_logs",
    "backup_logs",
  ]);
  if (adminOnlyReadResources.has(resource) && session?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "Forbidden — administrator privileges required." },
      { status: 403 }
    );
  }

  if (resource === "isbn_lookup") {
    if (getSupabaseSecretKey() && session) {
      try {
        const supabase = createSupabaseServerClient(true);
        await verifyRepositoryActor(
          supabase,
          session.userId,
          STAFF_ROLES,
          session.sessionToken
        );
      } catch (err) {
        return toErrorResponse(err);
      }
    }
    const result = await lookupByIsbn(isbn || "");
    return NextResponse.json(result);
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  try {
    const supabase = createSupabaseServerClient(true);
    const parseBoolParam = (v?: string) =>
      v === undefined ? undefined : v === "true" || v === "1";

    const payload = await getAdminResourceData(
      supabase,
      resource,
      isStaff && session ? session.userId : null,
      {
        id,
        from,
        to,
        isStaff,
        sessionRole: session?.role ?? null,
        sessionToken: isStaff && session ? session.sessionToken : null,
        page,
        pageSize: pageSize ?? limit,
        q,
        isbn,
        status,
        category,
        condition,
        available: parseBoolParam(available),
        damaged: parseBoolParam(damaged),
        overdue: parseBoolParam(overdue),
        format,
        sort,
        order,
      },
      isStaff && session ? session.role : null
    );
    if (
      format === "csv" &&
      (resource === "library_cards" || resource === "returns")
    ) {
      const verifiedActor = session
        ? await verifyRepositoryActor(
            supabase,
            session.userId,
            STAFF_ROLES,
            session.sessionToken
          )
        : null;
      const rows = Array.isArray((payload as { rows?: unknown[] }).rows)
        ? ((payload as { rows: Array<Record<string, unknown>> }).rows)
        : [];
      const csv = buildBorrowHistoryCsv(rows, {
        isLibrarian: verifiedActor
          ? verifiedActor.role === "librarian"
          : session?.role === "librarian",
        resource,
      });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${resource}-export.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof AdminMutationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    if (err instanceof AppError) {
      return toErrorResponse(err);
    }
    const message = err instanceof Error ? err.message : "Database query failed";
    await recordErrorLog({
      level: "error",
      source: "API",
      route: `/api/admin/data?resource=${resource}`,
      method: "GET",
      status_code: 500,
      message,
      user_email: session ? `user#${session.userId}` : "",
    });
    return toErrorResponse(err);
  }
}

async function processMutationRequest(
  request: Request,
  defaultAction: string
) {
  let resource = "";
  let action = defaultAction;

  try {
    const session = await requireStaff();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    const parsedBody = adminMutationSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return toErrorResponse(parsedBody.error);
    }

    const { resource: validatedResource, id: rawId, payload } = parsedBody.data;
    resource = validatedResource;
    action = (parsedBody.data.action ?? defaultAction).trim();

    const adminOnlyWriteResources = new Set([
      "users",
      "librarians",
      "admins",
      "event_categories",
      "system_settings",
      "error_logs",
    ]);
    if (
      (adminOnlyWriteResources.has(resource) ||
        (resource === "library_cards" && action === "waive_fine")) &&
      !isAdminRole(session.role)
    ) {
      return NextResponse.json(
        { ok: false, error: "Only Administrators can perform this action." },
        { status: 403 }
      );
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);

    if (resource === "error_logs") {
      await verifyRepositoryActor(
        supabase,
        session.userId,
        ["admin"],
        session.sessionToken
      );
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
            user_email: `user#${session.userId}`,
          },
          supabase
        );
        return NextResponse.json({ ok: true, entry });
      }
      if (action === "resolve") {
        if (!rawId) {
          return NextResponse.json({ ok: false, error: "Log ID is required." }, { status: 400 });
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
          return NextResponse.json({ ok: false, error: "Log ID is required." }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    return toErrorResponse(err);
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
