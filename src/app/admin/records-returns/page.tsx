import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminRecordsReturnsPage() {
  return (
    <AdminResourceView
      title="Records &"
      accentWord="Returns"
      subtitle="Processed book return transactions and returned copy quantities."
      resource="returns"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "return_id", label: "Return #", mono: true },
        { key: "book_title", label: "Book Title" },
        { key: "book_author", label: "Author" },
        { key: "book_isbn", label: "ISBN", mono: true },
        { key: "qty_returned", label: "Qty Returned", mono: true },
      ]}
    />
  );
}
