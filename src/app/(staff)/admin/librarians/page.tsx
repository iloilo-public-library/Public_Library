import { AccountManagementView } from "@/components/admin/accounts/AccountManagementView";

export default function AdminLibrariansPage() {
  return (
    <AccountManagementView
      config={{
        resource: "librarians",
        topbarTitle: "Librarian Management",
        headingPrefix: "Librarian",
        headingAccent: "Management",
        subtitle: "View, manage and control librarian accounts",
        singularLabel: "librarian",
        pluralLabel: "librarians",
        totalStatLabel: "Total Librarians",
        searchPlaceholder: "Search username, name…",
        emptyText: "No librarian accounts found.",
        showUsernameColumn: true,
        showLastSeenColumn: true,
        showAccountStatusColumn: false,
        showDeactivatedStat: false,
        showFilterTabs: false,
        enablePagination: false,
        enableViewDetails: false,
        enableDeactivateToggle: false,
        enableAddModal: true,
        addRole: "librarian",
        deletePromptPrefix: "Delete librarian",
        deleteSubtext: "This action cannot be undone.",
        deleteSuccessToast: "Librarian deleted",
      }}
    />
  );
}
