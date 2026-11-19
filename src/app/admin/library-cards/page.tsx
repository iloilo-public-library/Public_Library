import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminLibraryCardsPage() {
  return (
    <AdminResourceView
      title="Library"
      accentWord="Cards"
      subtitle="Issued member and borrower cards, return dates, and renewal status."
      resource="library_cards"
      columns={[
        { key: "id", label: "Card ID", mono: true },
        { key: "card_type_category", label: "Category" },
        { key: "user_id", label: "User ID", mono: true },
        { key: "card_type", label: "Type" },
        { key: "date_issued", label: "Issued", mono: true },
        { key: "date_return", label: "Due / Return", mono: true },
        { key: "valid_until", label: "Valid Until" },
        { key: "renewal1_checked", label: "Renewal 1" },
      ]}
    />
  );
}
