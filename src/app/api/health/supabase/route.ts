import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment variables are not configured." },
      { status: 503 }
    );
  }

  try {
    const supabase = createSupabaseServerClient(false);
    const { count, error } = await supabase
      .from("books")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          connected: true,
          schemaReady: false,
          error: error.message,
          hint: "Run supabase/migrations/001_initial_schema.sql in Supabase SQL Editor.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      schemaReady: true,
      booksCount: count ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
