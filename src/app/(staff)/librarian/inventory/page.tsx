import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function LibrarianInventoryPage() {
  return (
    <AdminResourceView
      role="librarian"
      title="Inventory"
      accentWord="& Conditions"
      subtitle="Live physical stock counts, individual damaged copy tracking (accession numbers), and sortable copy conditions."
      resource="inventory"
      columns={[
        { key: "id", label: "Inv #", mono: true },
        { key: "book_id", label: "Book ID", mono: true },
        { key: "book_title", label: "Book Title" },
        { key: "volumes", label: "Total Copies", mono: true },
        { key: "available_copies", label: "Available", mono: true },
        { key: "damaged_copies", label: "Damaged", mono: true },
        { key: "destroyed_copies", label: "Destroyed", mono: true },
        { key: "lost_copies", label: "Lost", mono: true },
        { key: "condition_status", label: "Condition" },
        { key: "damaged_accessions", label: "Flagged Copy IDs", mono: true },
        { key: "shelf_location", label: "Shelf Location" },
      ]}
    />
  );
}
