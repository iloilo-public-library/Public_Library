import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function LibrarianAnnouncementsPage() {
  return (
    <AdminResourceView
      role="librarian"
      title="Library"
      accentWord="Announcements"
      subtitle="Publish public notices, reminders, and community bulletins for patrons."
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
