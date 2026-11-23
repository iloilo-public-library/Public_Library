export type CopyCondition =
  | "Good"
  | "Fair"
  | "Damaged"
  | "Destroyed"
  | "Lost"
  | "Under Repair";

export type CirculationStatus =
  | "Available"
  | "Borrowed"
  | "Reserved"
  | "Unusable";

export interface BookCopyRecord {
  id: number;
  book_id: number;
  copy_number: number;
  accession_number: string;
  condition: CopyCondition;
  circulation_status: CirculationStatus;
  condition_notes: string;
  shelf_location: string | null;
  acquired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookWithInventoryRow {
  id: number; // inventory row PK (internal)
  book_id: number; // books.id (internal)
  catalog_code: string; // human-readable catalog identifier
  call_number: string | null;
  isbn: string | null;
  title: string;
  author: string;
  category: string | null;
  class: string | null;
  publisher: string | null;
  published_date: string | null;
  is_borrowable: boolean;
  volumes: number;
  available_copies: number;
  borrowed_copies: number;
  damaged_copies: number;
  lost_copies: number;
  condition_status: string;
  shelf_location: string | null;
  status: string;
  copies?: BookCopyRecord[];
}

export interface AddBookWithCopiesInput {
  isbn: string;
  title: string;
  author: string;
  call_number?: string | null;
  catalog_code?: string | null;
  accession_prefix?: string | null;
  category?: string | null;
  class?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  copies_to_add: number;
  shelf_location?: string | null;
  source_of_fund?: string | null;
  is_borrowable?: boolean;
}
