import { AccountRequestsView } from "@/components/account-requests/AccountRequestsView";

export default function LibrarianAccountRequestsPage() {
  return (
    <AccountRequestsView
      role="librarian"
      requestTypes={["renew"]}
      canApprove
      canReject
      canDelete
      canViewValidId={false}
    />
  );
}
