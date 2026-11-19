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
        { key: "fullname", label: "Full Name" },
        { key: "email", label: "Email", mono: true },
        { key: "status", label: "Session" },
        { key: "is_active", label: "Active" },
        { key: "is_locked", label: "Locked" },
        { key: "last_seen", label: "Last Seen", mono: true },
      ]}
    />
  );
}
