import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminAnnouncementsPage() {
  return (
    <AdminResourceView
      title="Library"
      accentWord="Announcements"
      subtitle="Public notices, maintenance alerts, and member notifications."
      resource="announcements"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "pinned", label: "Pinned" },
        { key: "author", label: "Author" },
        { key: "created_at", label: "Published", mono: true },
      ]}
    />
  );
}
