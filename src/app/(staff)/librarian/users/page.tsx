import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function LibrarianUsersPage() {
  return (
    <AdminResourceView
      role="librarian"
      title="User"
      accentWord="Management"
      subtitle="Registered patron accounts, demographics, and account verification status."
      resource="users"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "fullname", label: "Full Name" },
        { key: "email", label: "Email", mono: true },
        { key: "phone_number", label: "Phone", mono: true },
        { key: "city", label: "City" },
        { key: "status", label: "Session" },
        { key: "is_approved", label: "Approved" },
        { key: "is_active", label: "Active" },
        { key: "is_locked", label: "Locked" },
      ]}
    />
  );
}
