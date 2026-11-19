import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminBooksPage() {
  return (
    <AdminResourceView
      title="Book"
      accentWord="Management"
      subtitle="Cataloged titles, call numbers, editions, and borrowing policies."
      resource="books"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "call_number", label: "Call No.", mono: true },
        { key: "title", label: "Title" },
        { key: "author", label: "Author" },
        { key: "isbn", label: "ISBN", mono: true },
        { key: "published_date", label: "Published", mono: true },
        { key: "is_borrowable", label: "Borrowable" },
        { key: "api_source", label: "Source" },
      ]}
    />
  );
}
