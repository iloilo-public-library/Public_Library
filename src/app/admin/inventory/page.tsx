import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminInventoryPage() {
  return (
    <AdminResourceView
      title="Inventory"
      accentWord="& Conditions"
      subtitle="Live physical stock counts, individual damaged copy tracking (accession numbers), and sortable copy conditions."
      resource="inventory"
      columns={[
        { key: "id", label: "Inv #", mono: true },
        { key: "book_title", label: "Book Title" },
        { key: "volumes", label: "Total Copies", mono: true },
        { key: "available_copies", label: "Available Copies", mono: true },
        { key: "damaged_copies", label: "Damaged Copies", mono: true },
        { key: "lost_copies", label: "Lost", mono: true },
        { key: "condition_status", label: "Condition" },
        { key: "damaged_accessions", label: "Damaged Copy IDs", mono: true },
        { key: "shelf_location", label: "Shelf Location" },
      ]}
    />
  );
}
