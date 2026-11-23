import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function LibrarianBooksPage() {
  return (
    <AdminResourceView
      role="librarian"
      title="Book"
      accentWord="Management"
      subtitle="Cataloged titles, call numbers, ISBN lookup, available & damaged copy counts, and borrowing policies."
      resource="books"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "call_number", label: "Call No.", mono: true },
        { key: "title", label: "Title" },
        { key: "author", label: "Author" },
        { key: "category", label: "Category" },
        { key: "available_copies", label: "Available Copies", mono: true },
        { key: "damaged_copies", label: "Damaged Copies", mono: true },
        { key: "condition_status", label: "Condition" },
        { key: "is_borrowable", label: "Borrowable" },
      ]}
    />
  );
}
