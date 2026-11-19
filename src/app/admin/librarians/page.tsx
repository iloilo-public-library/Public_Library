import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminLibrariansPage() {
  return (
    <AdminResourceView
      title="Librarian"
      accentWord="Management"
      subtitle="Library staff accounts with circulation and catalog permissions."
      resource="librarians"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "username", label: "Account / Hash", mono: true },
        { key: "status", label: "Status" },
        { key: "is_approved", label: "Approved" },
        { key: "is_active", label: "Active" },
        { key: "last_seen", label: "Last Seen", mono: true },
      ]}
    />
  );
}
