import { AccountManagementView } from "@/components/admin/accounts/AccountManagementView";

export default function AdminUsersPage() {
  return (
    <AccountManagementView
      config={{
        resource: "users",
        topbarTitle: "User Management",
        headingPrefix: "User",
        headingAccent: "Management",
        subtitle: "View, manage and control user accounts",
        singularLabel: "user",
        pluralLabel: "users",
        totalStatLabel: "Total Users",
        searchPlaceholder: "Search name…",
        emptyText: "No user accounts found.",
        showUsernameColumn: false,
        showLastSeenColumn: false,
        showAccountStatusColumn: true,
        showDeactivatedStat: true,
        showFilterTabs: true,
        enablePagination: true,
        enableViewDetails: true,
        enableDeactivateToggle: true,
        enableAddModal: false,
        deletePromptPrefix: "Permanently delete",
        deleteSubtext:
          "This action cannot be undone. All user data will be removed.",
        deleteSuccessToast: "User deleted",
      }}
    />
  );
}
