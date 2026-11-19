import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminInventoryPage() {
  return (
    <AdminResourceView
      title="Inventory"
      accentWord="Status"
      subtitle="Live physical stock counts, shelf locations, damaged and lost copies from Supabase."
      resource="inventory"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "book_id", label: "Book ID", mono: true },
        { key: "volumes", label: "Volumes", mono: true },
        { key: "available_copies", label: "Available", mono: true },
        { key: "damaged_copies", label: "Damaged", mono: true },
        { key: "lost_copies", label: "Lost", mono: true },
        { key: "shelf_location", label: "Shelf Location" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
