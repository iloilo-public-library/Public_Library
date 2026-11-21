import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function LibrarianLibraryCardsPage() {
  return (
    <AdminResourceView
      role="librarian"
      title="Library"
      accentWord="Cards"
      subtitle="Issued member and borrower cards, borrowed books, return dates, and renewals."
      resource="library_cards"
      columns={[
        { key: "id", label: "Card ID", mono: true },
        { key: "card_type_category", label: "Category" },
        { key: "fullname", label: "Cardholder" },
        { key: "phone_number", label: "Phone", mono: true },
        { key: "books_count", label: "Books", mono: true },
        { key: "date_issued", label: "Issued", mono: true },
        { key: "date_return", label: "Due Date", mono: true },
        { key: "valid_until", label: "Valid Until" },
      ]}
    />
  );
}
