export interface CardBookItem {
  id: number;
  card_id?: number;
  book_id: number | null;
  book_title: string;
  book_author: string;
  book_isbn: string | null;
  quantity: number;
}

export interface LibraryCardRow {
  id: number;
  card_type_category: "member" | "borrower" | string;
  user_id: number | null;
  firstname: string;
  lastname: string;
  fullname: string;
  phone_number: string;
  address: string;
  date_issued: string;
  date_return: string | null;
  renewal1_checked: boolean;
  renewal1_date: string | null;
  renewal2_checked: boolean;
  renewal2_date: string | null;
  card_type: string;
  valid_until: string | null;
  photo_path: string | null;
  registered_by: number | string | null;
  created_at: string;
  books: CardBookItem[];
  books_count: number;
}

export interface ReturnItemRow {
  id: number;
  return_id: number;
  card_id: number | null;
  card_book_id: number | null;
  book_title: string;
  book_author: string;
  book_isbn: string | null;
  qty_returned: number;
  return_date: string;
  borrower_name: string;
  card_category: string;
}

export interface PickerMember {
  id: number;
  fullname: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  is_active?: boolean;
  is_approved?: boolean;
  library_card_number?: string | null;
}

export interface CatalogBookCopy {
  id?: number;
  book_id?: number;
  copy_number?: number;
  accession_number?: string;
  condition?: string;
  circulation_status?: string;
  shelf_location?: string;
}

export interface CatalogBook {
  id: number;
  title: string;
  author: string;
  isbn: string;
  category: string;
  thumbnail_url: string;
  available_copies: number;
  total_copies?: number;
  status?: string;
  catalog_code?: string;
  call_number?: string;
  is_borrowable?: boolean;
  copies?: CatalogBookCopy[];
}

export interface CirculationToast {
  id: number;
  message: string;
  tone: "success" | "danger" | "info";
}

export function getManilaTodayISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function getManilaLongDate(): string {
  return new Date().toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function computeAutoValidUntil(cardType: string): string {
  if (cardType === "city_govt") {
    return "Until retirement or separation from service";
  }
  if (cardType === "regular") {
    const today = getManilaTodayISO();
    const [y, m, d] = today.split("-").map(Number);
    const nextYear = new Date(Date.UTC(y + 1, m - 1, d, 12));
    return nextYear.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return "";
}

export function getDaysOverdue(dateReturn: string | null | undefined, todayISO: string): number {
  if (!dateReturn) return 0;
  const due = dateReturn.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due >= todayISO) return 0;
  const [dy, dm, dd] = due.split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  const diff = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(dy, dm - 1, dd)) / 86_400_000
  );
  return Math.max(0, diff);
}

export function formatCardTypeLabel(ct: string | null | undefined): string {
  if (ct === "city_govt") return "LGU";
  if (ct === "regular") return "Regular";
  return "—";
}
