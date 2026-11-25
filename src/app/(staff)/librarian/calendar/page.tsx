"use client";

import { EventCalendarView } from "@/components/calendar/EventCalendarView";

export default function LibrarianCalendarPage() {
  return (
    <EventCalendarView
      role="librarian"
      subtitle="Hover any date to add an event · Philippines Standard Time (UTC+8)"
      canCreate
      canEdit
      canDelete
      canReschedule
      canUploadCover
      canManageCategories={false}
    />
  );
}
