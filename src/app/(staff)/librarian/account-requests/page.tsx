import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function LibrarianAccountRequestsPage() {
  return (
    <AdminResourceView
      role="librarian"
      title="Renewal"
      accentWord="Requests"
      subtitle="Review and process pending library card renewal requests submitted by patrons."
      resource="account_requests"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "fullname", label: "Applicant" },
        { key: "email", label: "Email", mono: true },
        { key: "request_type", label: "Type" },
        { key: "phone_number", label: "Phone", mono: true },
        { key: "status", label: "Status" },
        { key: "admin_note", label: "Staff Note" },
        { key: "created_at", label: "Submitted", mono: true },
      ]}
    />
  );
}
