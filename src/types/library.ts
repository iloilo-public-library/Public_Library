export interface Book {
  id: number;
  call_number: string;
  date_received: string;
  class: string;
  genre: string;
  author: string;
  title: string;
  isbn: string;
  edition: string;
  page_count: number | null;
  category: string;
  source_of_fund: string;
  cost_price: number;
  publisher: string;
  copy_right: string;
  subtitle: string;
  published_date: string;
  description: string;
  language: string;
  thumbnail_url: string;
  api_source: string;
  is_borrowable: boolean;
  created_at: string;
  updated_at: string;
  total_copies: number;
  available_copies: number;
}

export interface BooksApiResponse {
  books: Book[];
  error?: string;
}

export interface DashboardStats {
  total_books?: number;
  available_books?: number;
  borrowed_books?: number;
  overdue_books?: number;
  total_users?: number;
  total_librarians?: number;
  pending_requests?: number;
  active_cards?: number;
  [key: string]: unknown;
}
