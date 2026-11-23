import { AccountManagementView } from "@/components/admin/accounts/AccountManagementView";

export default function AdminAdminsPage() {
  return (
    <AccountManagementView
      config={{
        resource: "admins",
        topbarTitle: "Admin Management",
        headingPrefix: "Admin",
        headingAccent: "Management",
        subtitle: "View, manage and control Admin accounts",
        singularLabel: "admin",
        pluralLabel: "admins",
        totalStatLabel: "Total Admins",
        searchPlaceholder: "Search username, name…",
        emptyText: "No admin accounts found.",
        showUsernameColumn: true,
        showLastSeenColumn: true,
        showAccountStatusColumn: false,
        showDeactivatedStat: false,
        showFilterTabs: false,
        enablePagination: false,
        enableViewDetails: false,
        enableDeactivateToggle: false,
        enableAddModal: true,
        addRole: "admin",
        deletePromptPrefix: "Delete admin",
        deleteSubtext: "This action cannot be undone.",
        deleteSuccessToast: "Admin deleted",
      }}
    />
  );
}
