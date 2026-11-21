import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function LibrarianBooksPage() {
  return (
    <AdminResourceView
      role="librarian"
      title="Book"
      accentWord="Management"
      subtitle="Cataloged titles, call numbers, ISBN lookup, stock counts, and borrowing policies."
      resource="books"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "call_number", label: "Call No.", mono: true },
        { key: "title", label: "Title" },
        { key: "author", label: "Author" },
        { key: "category", label: "Category" },
        { key: "isbn", label: "ISBN", mono: true },
        { key: "volumes", label: "Volumes", mono: true },
        { key: "available_copies", label: "Available", mono: true },
        { key: "is_borrowable", label: "Borrowable" },
      ]}
    />
  );
}
