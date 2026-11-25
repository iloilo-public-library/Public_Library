"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Menu,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import {
  useTheme,
  type LanguageMode,
  type ThemeMode,
} from "@/components/theme-provider";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import { SettingsSidebar } from "@/components/admin-settings/SettingsSidebar";
import { OverviewSection } from "@/components/admin-settings/OverviewSection";
import { PersonalDetailsSection } from "@/components/admin-settings/PersonalDetailsSection";
import { SecuritySection } from "@/components/admin-settings/SecuritySection";
import { AppearanceSection } from "@/components/admin-settings/AppearanceSection";
import {
  getInitials,
  type AdminProfileResponse,
  type PersonalSubTab,
  type SectionId,
} from "@/components/admin-settings/types";
import "@/components/admin-settings/admin-settings.css";

interface SearchSettingItem {
  label: string;
  keywords: string;
  section: SectionId;
  sectionLabel: string;
  personalTab?: PersonalSubTab;
}

const SEARCH_SETTINGS_INDEX: SearchSettingItem[] = [
  {
    label: "Account Summary",
    keywords: "overview summary email status librarian since phone role",
    section: "overview",
    sectionLabel: "Overview",
  },
  {
    label: "Login Activity",
    keywords: "login activity sessions duration hours history recent",
    section: "overview",
    sectionLabel: "Overview",
  },
  {
    label: "First Name & Last Name",
    keywords: "personal details profile info basic name",
    section: "personal",
    sectionLabel: "Personal Details",
    personalTab: "info",
  },
  {
    label: "Gender",
    keywords: "personal details gender male female others",
    section: "personal",
    sectionLabel: "Personal Details",
    personalTab: "info",
  },
  {
    label: "Phone Number",
    keywords: "contact phone mobile telephone number",
    section: "personal",
    sectionLabel: "Personal Details",
    personalTab: "contact",
  },
  {
    label: "Multi-Factor Authentication (OTP & PIN)",
    keywords: "security mfa otp one-time password pin code verification",
    section: "security",
    sectionLabel: "Password & Security",
  },
  {
    label: "Change Password",
    keywords: "security password update current new confirm strength",
    section: "security",
    sectionLabel: "Password & Security",
  },
  {
    label: "Color Theme",
    keywords: "appearance color theme dark light default mode",
    section: "appearance",
    sectionLabel: "Appearance",
  },
  {
    label: "Interface Language",
    keywords: "appearance language english filipino hiligaynon",
    section: "appearance",
    sectionLabel: "Appearance",
  },
];

function parseHashToSection(hash: string): SectionId {
  const cleaned = hash.replace(/^#/, "").replace(/^sec-/, "").toLowerCase();
  if (
    cleaned === "overview" ||
    cleaned === "personal" ||
    cleaned === "security" ||
    cleaned === "appearance"
  ) {
    return cleaned;
  }
  return "overview";
}

interface ToastItem {
  id: number;
  ok: boolean;
  msg: string;
}

export default function LibrarianSettingsPage() {
  const router = useRouter();
  const { theme, language, previewAppearance, saveAppearance } = useTheme();

  const { data, error, isLoading, mutate } = useSWR<AdminProfileResponse>(
    "/api/admin/data?resource=admin_profile",
    swrPrivateConfig
  );

  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [personalTab, setPersonalTab] = useState<PersonalSubTab>("info");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  // Profile state (saved vs draft)
  const [savedFirstname, setSavedFirstname] = useState("");
  const [savedLastname, setSavedLastname] = useState("");
  const [savedGender, setSavedGender] = useState("");
  const [savedPhone, setSavedPhone] = useState("");

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Appearance draft preview state
  const [draftTheme, setDraftTheme] = useState<ThemeMode>(theme);
  const [draftLanguage, setDraftLanguage] = useState<LanguageMode>(language);

  // Saving & feedback state
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((ok: boolean, msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, ok, msg }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    const f = p.firstname.startsWith("gAAAAAB") ? "" : p.firstname;
    const l = p.lastname.startsWith("gAAAAAB") ? "" : p.lastname;
    const g = p.gender.startsWith("gAAAAAB") ? "" : p.gender;
    const ph = p.phone_number.startsWith("gAAAAAB") ? "" : p.phone_number;
    setSavedFirstname(f);
    setSavedLastname(l);
    setSavedGender(g);
    setSavedPhone(ph);
    setFirstname(f);
    setLastname(l);
    setGender(g);
    setPhone(ph);
  }, [data?.profile]);

  useEffect(() => {
    setDraftTheme(theme);
  }, [theme]);

  useEffect(() => {
    setDraftLanguage(language);
  }, [language]);

  useEffect(() => {
    previewAppearance({ theme: draftTheme, language: draftLanguage });
    return () => {
      previewAppearance({ theme, language });
    };
  }, [draftTheme, draftLanguage, theme, language, previewAppearance]);

  useEffect(() => {
    const syncFromHash = () => {
      setActiveSection(parseHashToSection(window.location.hash));
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  // Close unsaved changes modal on Escape
  useEffect(() => {
    if (!pendingLeaveHref) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingLeaveHref(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pendingLeaveHref]);

  const handleSelectSection = useCallback((section: SectionId) => {
    setActiveSection(section);
    mainScrollRef.current?.scrollTo({ top: 0 });
    const nextHash = `#${section}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
  }, []);

  const isProfileDirty =
    firstname !== savedFirstname ||
    lastname !== savedLastname ||
    gender !== savedGender ||
    phone !== savedPhone;

  const isAppearanceDirty = draftTheme !== theme || draftLanguage !== language;
  const hasUnsavedChanges = isProfileDirty || isAppearanceDirty;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  const commitProfile = useCallback(async (): Promise<boolean> => {
    if (!firstname.trim() || !lastname.trim()) {
      pushToast(false, "First Name and Last Name cannot be empty.");
      return false;
    }
    setSavingProfile(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "admin_profile",
          action: "update_profile",
          payload: {
            firstname,
            lastname,
            gender,
            phone_number: phone,
          },
        },
      });
      await mutate();
      setSavedFirstname(firstname);
      setSavedLastname(lastname);
      setSavedGender(gender);
      setSavedPhone(phone);
      pushToast(true, "Personal profile updated.");
      return true;
    } catch (err) {
      pushToast(false, err instanceof Error ? err.message : "Failed to save profile.");
      return false;
    } finally {
      setSavingProfile(false);
    }
  }, [firstname, lastname, gender, phone, mutate, pushToast]);

  const handleSaveAll = async () => {
    if (!hasUnsavedChanges) return;
    let profileOk = true;

    if (isProfileDirty) {
      profileOk = await commitProfile();
    }

    if (isAppearanceDirty) {
      setSavingAppearance(true);
      try {
        const res = await saveAppearance({
          theme: draftTheme,
          language: draftLanguage,
        });
        if (res.ok) {
          pushToast(true, isProfileDirty && profileOk ? "All changes saved." : "Changes saved");
        } else {
          pushToast(false, res.error || "Could not save appearance.");
        }
      } finally {
        setSavingAppearance(false);
      }
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPw(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "admin_profile",
          action: "change_password",
          payload: {
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword,
          },
        },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      pushToast(true, "Password changed successfully.");
    } catch (err) {
      pushToast(false, err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSavingPw(false);
    }
  };

  const handleToggleSecurity = async (method: "otp" | "pin", nextVal: boolean) => {
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "admin_profile",
          action: "toggle_security",
          payload: { method, enabled: nextVal },
        },
      });
      await mutate();
      pushToast(
        true,
        `${method.toUpperCase()} verification ${nextVal ? "enabled" : "disabled"}.`
      );
    } catch (err) {
      pushToast(
        false,
        err instanceof Error ? err.message : "Failed to update security flag."
      );
    }
  };

  const handleNavigateAway = useCallback(
    (href: string) => {
      if (hasUnsavedChanges) {
        setPendingLeaveHref(href);
        return;
      }
      if (href === "/logout") {
        try {
          window.localStorage.removeItem("icpl-theme-mode");
          window.localStorage.removeItem("icpl-staff-language");
        } catch {
          // ignore storage errors
        }
        window.location.assign(href);
      } else {
        router.push(href);
      }
    },
    [hasUnsavedChanges, router]
  );

  const confirmLeave = () => {
    if (!pendingLeaveHref) return;
    const href = pendingLeaveHref;
    setPendingLeaveHref(null);
    previewAppearance({ theme, language });
    if (href === "/logout") {
      try {
        window.localStorage.removeItem("icpl-theme-mode");
        window.localStorage.removeItem("icpl-staff-language");
      } catch {
        // ignore storage errors
      }
      window.location.assign(href);
    } else {
      router.push(href);
    }
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_SETTINGS_INDEX.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.keywords.includes(q) ||
        item.sectionLabel.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const p = data?.profile;
  const sessions = data?.loginActivity ?? [];
  const displayName =
    p?.fullname && !p.fullname.startsWith("gAAAAAB")
      ? p.fullname
      : [firstname, lastname].filter(Boolean).join(" ") || "Librarian";
  const initials = getInitials(firstname, lastname, displayName, p?.email ?? "");
  const showSecurityBadge = Boolean(p && !p.otp_enabled && !p.pin_enabled);

  const librarianSince = p?.created_at
    ? new Date(p.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="admin-settings-page flex w-full overflow-x-hidden">
      {/* Left Sidebar (reused from admin-settings, configured for librarian) */}
      <SettingsSidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        initials={initials}
        fullname={displayName}
        email={p?.email || (isLoading ? "Loading..." : "—")}
        showSecurityBadge={showSecurityBadge}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onNavigateAway={handleNavigateAway}
        role="librarian"
        homeHref="/librarian/home"
      />

      {/* Right Main Area */}
      <div
        ref={mainScrollRef}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain"
      >
        {/* Sticky Topbar */}
        <header
          className="sticky top-0 z-[100] flex h-[60px] shrink-0 items-center justify-between gap-3 px-5 backdrop-blur-md lg:px-9"
          style={{
            backgroundColor: "var(--as-topbar-bg)",
            borderBottom: "1px solid var(--as-border)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open settings menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition cursor-pointer lg:hidden"
              style={{
                border: "1px solid var(--as-border)",
                color: "var(--as-text-primary)",
              }}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2.5 text-[1rem] font-bold tracking-[-0.02em]">
              <Settings
                className="h-[18px] w-[18px] shrink-0"
                style={{ color: "var(--accent)" }}
                aria-hidden="true"
              />
              <span>Settings</span>
            </div>
          </div>

          <button
            type="button"
            disabled={!hasUnsavedChanges || savingProfile || savingAppearance}
            onClick={() => void handleSaveAll()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              backgroundColor: "rgba(var(--accent-rgb), 0.12)",
              border: "1px solid rgba(var(--accent-rgb), 0.24)",
              color: "var(--accent)",
            }}
          >
            {savingProfile || savingAppearance ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Save Changes</span>
          </button>
        </header>

        {/* Main Content Wrap */}
        <main className="w-full max-w-[820px] shrink-0 px-5 pt-6 pb-24 lg:px-9 lg:pt-8 lg:pb-24">
          {error && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] px-4 py-3 text-xs"
              style={{
                backgroundColor: "rgba(var(--danger-rgb), 0.12)",
                border: "1px solid rgba(var(--danger-rgb), 0.3)",
                color: "var(--danger)",
              }}
            >
              <span>Could not load your account settings.</span>
              <button
                type="button"
                onClick={() => void mutate()}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold cursor-pointer"
                style={{
                  border: "1px solid rgba(var(--danger-rgb), 0.4)",
                  color: "var(--danger)",
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          {/* Find a setting… Search */}
          <div className="relative mb-7">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--as-text-muted)" }}
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Find a setting"
              placeholder="Find a setting… (e.g. password, theme)"
              className="min-h-[46px] w-full rounded-[12px] py-3 pl-[42px] pr-10 text-[0.92rem]"
              style={{
                backgroundColor: "var(--as-input-bg)",
                border: "1px solid var(--as-border)",
                color: "var(--as-text-primary)",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md cursor-pointer"
                style={{ color: "var(--as-text-muted)" }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            {searchQuery.trim().length > 0 && (
              <div
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[12px] shadow-xl"
                style={{
                  backgroundColor: "var(--as-card-bg)",
                  border: "1px solid var(--as-border)",
                }}
              >
                {searchResults.length === 0 ? (
                  <div
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--as-text-muted)" }}
                  >
                    No matching settings found.
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        handleSelectSection(item.section);
                        if (item.personalTab) setPersonalTab(item.personalTab);
                        setSearchQuery("");
                      }}
                      className="flex min-h-[44px] w-full items-center justify-between px-4 py-2.5 text-left text-[0.84rem] transition cursor-pointer hover:bg-white/[0.04]"
                      style={{
                        borderBottom: "1px solid var(--as-border-subtle)",
                        color: "var(--as-text-primary)",
                      }}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span
                        className="text-[0.72rem]"
                        style={{ color: "var(--as-text-muted)" }}
                      >
                        {item.sectionLabel}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Active Section */}
          {activeSection === "overview" && (
            <OverviewSection
              profile={p}
              displayName={displayName}
              isLoading={isLoading}
              adminSince={librarianSince}
              sessions={sessions}
              onSelectSection={handleSelectSection}
              role="librarian"
              phone={phone}
            />
          )}

          {activeSection === "personal" && (
            <PersonalDetailsSection
              personalTab={personalTab}
              onChangePersonalTab={setPersonalTab}
              firstname={firstname}
              lastname={lastname}
              gender={gender}
              phone={phone}
              savedFirstname={savedFirstname}
              savedLastname={savedLastname}
              savedGender={savedGender}
              savedPhone={savedPhone}
              email={p?.email || ""}
              savingProfile={savingProfile}
              onChangeFirstname={setFirstname}
              onChangeLastname={setLastname}
              onChangeGender={setGender}
              onChangePhone={setPhone}
              onCommitProfile={commitProfile}
            />
          )}

          {activeSection === "security" && (
            <SecuritySection
              otpEnabled={Boolean(p?.otp_enabled)}
              pinEnabled={Boolean(p?.pin_enabled)}
              onToggleSecurity={handleToggleSecurity}
              currentPassword={currentPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              onChangeCurrentPassword={setCurrentPassword}
              onChangeNewPassword={setNewPassword}
              onChangeConfirmPassword={setConfirmPassword}
              savingPw={savingPw}
              onSubmitPassword={handleChangePassword}
            />
          )}

          {activeSection === "appearance" && (
            <AppearanceSection
              draftTheme={draftTheme}
              draftLanguage={draftLanguage}
              isAppearanceDirty={isAppearanceDirty}
              onSelectTheme={setDraftTheme}
              onSelectLanguage={setDraftLanguage}
            />
          )}
        </main>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {pendingLeaveHref && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-modal-title"
        >
          <div
            className="w-full max-w-[400px] rounded-[16px] p-5 shadow-2xl"
            style={{
              backgroundColor: "var(--as-card-bg)",
              border: "1px solid var(--as-border)",
            }}
          >
            <h3
              id="unsaved-modal-title"
              className="mb-2 text-base font-bold"
              style={{ color: "var(--as-text-primary)" }}
            >
              Unsaved Changes
            </h3>
            <p
              className="mb-5 text-[0.84rem] leading-relaxed"
              style={{ color: "var(--as-text-secondary)" }}
            >
              You have unsaved changes. Leave this page without saving?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLeaveHref(null)}
                className="min-h-[44px] rounded-lg px-4 py-2 text-[0.8rem] font-semibold cursor-pointer"
                style={{
                  border: "1px solid var(--as-border)",
                  color: "var(--as-text-primary)",
                }}
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmLeave}
                className="min-h-[44px] rounded-lg px-4 py-2 text-[0.8rem] font-semibold cursor-pointer"
                style={{
                  backgroundColor: "rgba(var(--danger-rgb), 0.16)",
                  border: "1px solid rgba(var(--danger-rgb), 0.35)",
                  color: "var(--danger)",
                }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[400] flex max-w-[340px] flex-col gap-2"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2.5 rounded-[10px] px-4 py-2.5 text-[0.82rem] shadow-lg"
              style={{
                backgroundColor: "var(--as-card-bg)",
                border: "1px solid var(--as-border)",
                borderLeft: `3px solid ${t.ok ? "var(--accent2)" : "var(--danger)"}`,
                color: "var(--as-text-primary)",
              }}
            >
              {t.ok ? (
                <CheckCircle2
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--accent2)" }}
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--danger)" }}
                  aria-hidden="true"
                />
              )}
              <span>{t.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
