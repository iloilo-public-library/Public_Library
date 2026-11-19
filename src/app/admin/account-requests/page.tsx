import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminAccountRequestsPage() {
  return (
    <AdminResourceView
      title="Account"
      accentWord="Requests"
      subtitle="Pending and historical member registration, renewal, and account requests."
      resource="account_requests"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "user_id", label: "User ID", mono: true },
        { key: "request_type", label: "Type" },
        { key: "reason", label: "Reason" },
        { key: "status", label: "Status" },
        { key: "admin_note", label: "Admin Note" },
        { key: "created_at", label: "Submitted", mono: true },
      ]}
    />
  );
}
