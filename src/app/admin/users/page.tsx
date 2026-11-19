import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminUsersPage() {
  return (
    <AdminResourceView
      title="User"
      accentWord="Management"
      subtitle="Registered patron accounts, approval flags, and session status."
      resource="users"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "username", label: "Account / Hash", mono: true },
        { key: "status", label: "Status" },
        { key: "is_approved", label: "Approved" },
        { key: "is_active", label: "Active" },
        { key: "is_locked", label: "Locked" },
        { key: "last_seen", label: "Last Seen", mono: true },
      ]}
    />
  );
}
