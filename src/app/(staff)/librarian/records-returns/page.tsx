import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function LibrarianRecordsReturnsPage() {
  return (
    <AdminResourceView
      role="librarian"
      title="Records &"
      accentWord="Returns"
      subtitle="Processed book return transactions, borrowers, and restocked copy quantities."
      resource="returns"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "return_id", label: "Return #", mono: true },
        { key: "borrower_name", label: "Borrower" },
        { key: "book_title", label: "Book Title" },
        { key: "book_author", label: "Author" },
        { key: "qty_returned", label: "Qty", mono: true },
        { key: "return_date", label: "Return Date", mono: true },
      ]}
    />
  );
}
