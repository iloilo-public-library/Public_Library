import { BorrowHistoryView } from "@/components/circulation/BorrowHistoryView";

export default function LibrarianRecordsReturnsPage() {
  return (
    <BorrowHistoryView
      role="librarian"
      canReturn
      canRenew
      canExport
      canDelete
      canMarkLost
      canWaiveFine={false}
    />
  );
}
