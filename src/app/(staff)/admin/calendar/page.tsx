import { AdminResourceView } from "@/components/admin/AdminResourceView";

export default function AdminCalendarPage() {
  return (
    <AdminResourceView
      title="Calendar"
      accentWord="Events"
      subtitle="Scheduled library programs, workshops, and community sessions."
      resource="events"
      columns={[
        { key: "id", label: "ID", mono: true },
        { key: "title", label: "Event Title" },
        { key: "category", label: "Category" },
        { key: "event_date", label: "Date", mono: true },
        { key: "start_time", label: "Start", mono: true },
        { key: "location", label: "Location" },
      ]}
    />
  );
}
