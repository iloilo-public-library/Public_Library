import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminAccountRequestsPage() {
  return (
    <AdminResourceView
      title="Account"
      accentWord="Requests"
      subtitle="Review patron registrations, card renewals, deactivation, and deletion requests."
      resource="account_requests"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "fullname", label: "Applicant" },
        { key: "email", label: "Email", mono: true },
        { key: "request_type", label: "Type" },
        { key: "phone_number", label: "Phone", mono: true },
        { key: "status", label: "Status" },
        { key: "admin_note", label: "Admin Note" },
        { key: "created_at", label: "Submitted", mono: true },
      ]}
    />
  );
}
