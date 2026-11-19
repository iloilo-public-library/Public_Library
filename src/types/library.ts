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
  damaged_copies?: number;
  lost_copies?: number;
  shelf_location?: string;
  status?: string;
}

export interface BooksApiResponse {
  books: Book[];
  error?: string;
}

export interface DashboardStats {
  total_books?: number;
  total_volumes?: number;
  available_books?: number;
  borrowed_books?: number;
  damaged_books?: number;
  lost_books?: number;
  overdue_books?: number;
  total_users?: number;
  total_librarians?: number;
  total_admins?: number;
  online_users?: number;
  offline_users?: number;
  locked_users?: number;
  approved_users?: number;
  pending_requests?: number;
  active_cards?: number;
  total_returns?: number;
  roles?: {
    admin: number;
    librarian: number;
    user: number;
  };
  status?: {
    active: number;
    offline: number;
    locked: number;
  };
  books_per_day?: {
    label: string;
    count: number;
  }[];
  source?: string;
  [key: string]: unknown;
}
