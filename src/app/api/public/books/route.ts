import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeDecryptData } from "@/lib/crypto/fernet";

function cleanCatalogField(val: string | null | undefined, fallback = ""): string {
  const dec = safeDecryptData(val ?? "");
  if (!dec || dec.startsWith("gAAAAAB")) return fallback;
  return dec;
}

export const revalidate = 60;

interface InventoryRow {
  volumes: number | null;
  available_copies: number | null;
  shelf_location: string | null;
  status: string | null;
}

interface BookRow {
  id: number;
  call_number: string | null;
  date_received: string | null;
  class: string | null;
  author: string | null;
  title: string | null;
  isbn: string | null;
  edition: string | null;
  page_count: number | null;
  category: string | null;
  source_of_fund: string | null;
  cost_price: number | null;
  publisher: string | null;
  copy_right: string | null;
  subtitle: string | null;
  published_date: string | null;
  description: string | null;
  language: string | null;
  thumbnail_url: string | null;
  api_source: string | null;
  is_borrowable: boolean;
  created_at: string;
  updated_at: string;
  book_inventory: InventoryRow[] | null;
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient(false);

    const { data, error } = await supabase
      .from("books")
      .select(
        `
        id, call_number, date_received, class, author, title, isbn, edition,
        page_count, category, source_of_fund, cost_price, publisher, copy_right,
        subtitle, published_date, description, language, thumbnail_url, api_source,
        is_borrowable, created_at, updated_at,
        book_inventory ( volumes, available_copies, shelf_location, status )
      `
      )
      .order("id", { ascending: false });

    if (error) {
      return NextResponse.json({ books: [], error: error.message }, { status: 500 });
    }

    const books = ((data ?? []) as BookRow[]).map((b) => {
      const inv = Array.isArray(b.book_inventory)
        ? b.book_inventory
        : b.book_inventory
          ? [b.book_inventory]
          : [];
      const totalCopies = inv.reduce((sum, row) => sum + (row.volumes ?? 0), 0);
      const availableCopies = inv.reduce((sum, row) => sum + (row.available_copies ?? 0), 0);

      const bookClass = cleanCatalogField(b.class, "General Collection");
      const bookCategory = cleanCatalogField(b.category, "General");

      return {
        id: b.id,
        call_number: b.call_number ?? "",
        date_received: b.date_received ?? "",
        class: bookClass,
        genre: bookClass,
        author: cleanCatalogField(b.author, "Library Author"),
        title: cleanCatalogField(b.title, b.subtitle || `Catalog Volume #${b.id}`),
        isbn: cleanCatalogField(b.isbn, ""),
        edition: b.edition ?? "",
        page_count: b.page_count,
        category: bookCategory,
        source_of_fund: b.source_of_fund ?? "",
        cost_price: Number(b.cost_price ?? 0),
        publisher: cleanCatalogField(b.publisher, ""),
        copy_right: b.copy_right ?? "",
        subtitle: b.subtitle ?? "",
        published_date: b.published_date ?? "",
        description: (b.description ?? "").replace(/\r|\n/g, " ").trim(),
        language: (b.language ?? "en").trim(),
        thumbnail_url: b.thumbnail_url ?? "",
        api_source: b.api_source ?? "",
        is_borrowable: Boolean(b.is_borrowable),
        created_at: b.created_at,
        updated_at: b.updated_at,
        total_copies: totalCopies,
        available_copies: availableCopies,
      };
    });

    return NextResponse.json(
      { books, source: "supabase" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to query Supabase";
    return NextResponse.json({ books: [], error: message }, { status: 500 });
  }
}
