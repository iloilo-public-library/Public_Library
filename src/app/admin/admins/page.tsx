import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminAdminsPage() {
  return (
    <AdminResourceView
      title="Admin"
      accentWord="Accounts"
      subtitle="System administrators with full governance, audit, and security access."
      resource="admins"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "username", label: "Account / Hash", mono: true },
        { key: "status", label: "Status" },
        { key: "is_active", label: "Active" },
        { key: "last_seen", label: "Last Seen", mono: true },
      ]}
    />
  );
}
