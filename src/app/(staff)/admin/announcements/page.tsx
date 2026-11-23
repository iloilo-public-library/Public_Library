"use client";

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Megaphone,
  Pin,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { AnnouncementModal } from "@/components/announcements/AnnouncementModal";
import { DeleteAnnouncementModal } from "@/components/announcements/DeleteAnnouncementModal";
import {
  isAnnouncementToday,
  normalizeCategory,
  type AnnouncementFormValues,
  type AnnouncementRow,
  type CategoryFilter,
} from "@/components/announcements/types";
import "@/components/announcements/announcements.css";

interface AnnouncementsResponse {
  rows: AnnouncementRow[];
}

interface ToastItem {
  id: number;
  type: "success" | "error";
  msg: string;
}

const FILTER_PILLS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "general", label: "General" },
  { value: "urgent", label: "Urgent" },
  { value: "event", label: "Event" },
  { value: "reminder", label: "Reminder" },
];

const EMPTY_FORM: AnnouncementFormValues = {
  title: "",
  body: "",
  category: "general",
  pinned: false,
  target_user_id: null,
  target_user_name: null,
};

export default function AdminAnnouncementsPage() {
  const { data, error, isLoading, mutate } = useSWR<AnnouncementsResponse>(
    "/api/admin/data?resource=announcements",
    swrPrivateConfig
  );

  const [currentFilter, setCurrentFilter] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<AnnouncementFormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pinning row ID
  const [pinningId, setPinningId] = useState<number | null>(null);

  // Focus return ref
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((type: "success" | "error", msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, msg }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const announcements = data?.rows ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return announcements.filter((a) => {
      const cat = normalizeCategory(a.category);
      const matchesCat = currentFilter === "all" || cat === currentFilter;
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [announcements, currentFilter, searchQuery]);

  const pinnedList = useMemo(() => filtered.filter((a) => a.pinned), [filtered]);
  const unpinnedList = useMemo(() => filtered.filter((a) => !a.pinned), [filtered]);

  const totalCount = announcements.length;
  const pinnedCount = useMemo(
    () => announcements.filter((a) => a.pinned).length,
    [announcements]
  );
  const todayCount = useMemo(
    () => announcements.filter((a) => isAnnouncementToday(a.created_at)).length,
    [announcements]
  );

  const restoreFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      lastTriggerRef.current?.focus();
    });
  }, []);

  const handleOpenCreate = (triggerEl: HTMLButtonElement | null) => {
    lastTriggerRef.current = triggerEl;
    setEditingId(null);
    setFormValues(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (
    ann: AnnouncementRow,
    triggerEl: HTMLButtonElement | null
  ) => {
    lastTriggerRef.current = triggerEl;
    setEditingId(ann.id);
    setFormValues({
      title: ann.title,
      body: ann.body,
      category: normalizeCategory(ann.category),
      pinned: Boolean(ann.pinned),
      target_user_id: ann.target_user_id ?? null,
      target_user_name: ann.target_user_name ?? null,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setFormError(null);
    restoreFocus();
  }, [restoreFocus]);

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    const title = formValues.title.trim();
    const body = formValues.body.trim();

    if (!title) {
      setFormError("Please enter a title.");
      pushToast("error", "Please enter a title.");
      return;
    }
    if (!body) {
      setFormError("Please enter a message.");
      pushToast("error", "Please enter a message.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId !== null) {
        await apiMutate("/api/admin/data", {
          method: "PUT",
          body: {
            resource: "announcements",
            action: "update",
            id: editingId,
            payload: {
              title,
              body,
              category: formValues.category,
              pinned: formValues.pinned,
            },
          },
        });
        await mutate();
        setModalOpen(false);
        pushToast("success", "Announcement updated!");
        restoreFocus();
      } else {
        await apiMutate("/api/admin/data", {
          method: "POST",
          body: {
            resource: "announcements",
            action: "create",
            payload: {
              title,
              body,
              category: formValues.category,
              pinned: formValues.pinned,
              target_user_id: formValues.target_user_id,
            },
          },
        });
        await mutate();
        setModalOpen(false);
        pushToast("success", "Announcement posted!");
        restoreFocus();
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong.";
      // Keep form input intact when validation/save fails
      setFormError(msg);
      pushToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePin = async (ann: AnnouncementRow) => {
    const nextPinned = !ann.pinned;
    setPinningId(ann.id);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "announcements",
          action: "toggle_pin",
          id: ann.id,
          payload: { pinned: nextPinned },
        },
      });
      await mutate();
      pushToast("success", nextPinned ? "Pinned!" : "Unpinned.");
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error ? err.message : "Failed to update pin status."
      );
    } finally {
      setPinningId(null);
    }
  };

  const handleOpenDelete = (
    ann: AnnouncementRow,
    triggerEl: HTMLButtonElement | null
  ) => {
    lastTriggerRef.current = triggerEl;
    setDeleteTarget(ann);
  };

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    restoreFocus();
  }, [restoreFocus]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "DELETE",
        body: {
          resource: "announcements",
          action: "delete",
          id: deleteTarget.id,
        },
      });
      await mutate();
      setDeleteTarget(null);
      pushToast("success", "Announcement deleted.");
      restoreFocus();
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error ? err.message : "Failed to delete announcement."
      );
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilter = currentFilter !== "all" || searchQuery.trim().length > 0;

  return (
    <StaffShell title="Announcements">
      <div className="admin-announcements-page mx-auto max-w-[1100px] overflow-x-clip pb-8">
        {/* Page Header */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className="flex items-center gap-2.5 text-[1.75rem] font-bold tracking-[-0.03em]"
              style={{ color: "var(--ann-text-primary)" }}
            >
              <Megaphone
                className="h-7 w-7 shrink-0"
                style={{ color: "var(--accent)" }}
                aria-hidden="true"
              />
              <span>
                Announcements <span style={{ color: "var(--accent)" }}>Board</span>
              </span>
            </h1>
            <p className="mt-1 text-[0.88rem]" style={{ color: "var(--tl)" }}>
              Manage and publish announcements for library members
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => handleOpenCreate(e.currentTarget)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] px-5 py-2.5 text-[0.9rem] font-bold transition hover:-translate-y-[1px] cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--on-accent)",
            }}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Post Announcement</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div
            className="flex items-center gap-3.5 rounded-[14px] px-[18px] py-4 transition hover:-translate-y-0.5"
            style={{
              backgroundColor: "var(--ann-card-bg)",
              border: "1px solid var(--ann-border)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
              style={{
                backgroundColor: "rgba(var(--accent-rgb), 0.18)",
                color: "var(--accent)",
              }}
            >
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="mb-0.5 text-[0.73rem]" style={{ color: "var(--tl)" }}>
                Total
              </div>
              <div
                className="text-[1.4rem] font-bold leading-none"
                style={{ color: "var(--ann-text-primary)" }}
              >
                {totalCount}
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-3.5 rounded-[14px] px-[18px] py-4 transition hover:-translate-y-0.5"
            style={{
              backgroundColor: "var(--ann-card-bg)",
              border: "1px solid var(--ann-border)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
              style={{
                backgroundColor: "rgba(var(--warn-rgb), 0.18)",
                color: "var(--warn)",
              }}
            >
              <Pin className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="mb-0.5 text-[0.73rem]" style={{ color: "var(--tl)" }}>
                Pinned
              </div>
              <div
                className="text-[1.4rem] font-bold leading-none"
                style={{ color: "var(--ann-text-primary)" }}
              >
                {pinnedCount}
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-3.5 rounded-[14px] px-[18px] py-4 transition hover:-translate-y-0.5"
            style={{
              backgroundColor: "var(--ann-card-bg)",
              border: "1px solid var(--ann-border)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
              style={{
                backgroundColor: "rgba(var(--accent2-rgb), 0.18)",
                color: "var(--accent2)",
              }}
            >
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="mb-0.5 text-[0.73rem]" style={{ color: "var(--tl)" }}>
                Today
              </div>
              <div
                className="text-[1.4rem] font-bold leading-none"
                style={{ color: "var(--ann-text-primary)" }}
              >
                {todayCount}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter announcements by category"
          >
            {FILTER_PILLS.map((pill) => {
              const active = currentFilter === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCurrentFilter(pill.value)}
                  className="min-h-[44px] rounded-full px-4 py-1.5 text-[0.8rem] font-semibold transition cursor-pointer"
                  style={
                    active
                      ? {
                          backgroundColor: "rgba(var(--accent-rgb), 0.15)",
                          border: "1px solid var(--accent)",
                          color: "var(--accent)",
                        }
                      : {
                          backgroundColor: "var(--ann-pill-bg)",
                          border: "1px solid var(--ann-pill-border)",
                          color: "var(--ann-text-muted)",
                        }
                  }
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          <div
            className="relative flex min-h-[44px] w-full items-center gap-2 rounded-full px-4 py-1.5 md:ml-auto md:w-auto"
            style={{
              backgroundColor: "var(--ann-input-bg)",
              border: "1px solid var(--ann-input-border)",
            }}
          >
            <Search
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--ann-text-muted)" }}
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search announcements"
              placeholder="Search announcements…"
              className="w-full bg-transparent text-[0.84rem] outline-none md:w-[190px]"
              style={{ color: "var(--ann-text-primary)" }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="flex h-7 w-7 items-center justify-center rounded-full cursor-pointer"
                style={{ color: "var(--ann-text-muted)" }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-[16px] py-16 text-center"
            style={{
              backgroundColor: "var(--ann-card-bg)",
              border: "1px solid var(--ann-border)",
              color: "var(--ann-text-muted)",
            }}
          >
            <Loader2
              className="h-7 w-7 animate-spin"
              style={{ color: "var(--accent)" }}
              aria-hidden="true"
            />
            <p className="text-[0.85rem]">Loading announcements…</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 rounded-[16px] px-6 py-14 text-center"
            style={{
              backgroundColor: "rgba(var(--danger-rgb), 0.08)",
              border: "1px solid rgba(var(--danger-rgb), 0.3)",
            }}
          >
            <AlertCircle
              className="h-8 w-8"
              style={{ color: "var(--danger)" }}
              aria-hidden="true"
            />
            <p className="text-[0.9rem] font-semibold" style={{ color: "var(--danger)" }}>
              Failed to load announcements.
            </p>
            <button
              type="button"
              onClick={() => void mutate()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2 text-[0.82rem] font-semibold transition cursor-pointer"
              style={{
                backgroundColor: "var(--ann-pill-bg)",
                border: "1px solid var(--ann-pill-border)",
                color: "var(--ann-text-primary)",
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* Pinned + All Announcements Grids */}
        {!isLoading && !error && (
          <>
            {pinnedList.length > 0 && (
              <section aria-label="Pinned announcements" className="mb-6">
                <div className="ann-section-label">
                  <Pin
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: "var(--warn)" }}
                    aria-hidden="true"
                  />
                  <span>Pinned</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pinnedList.map((ann, idx) => (
                    <AnnouncementCard
                      key={ann.id}
                      announcement={ann}
                      delayMs={idx * 50}
                      pinning={pinningId === ann.id}
                      onTogglePin={(item) => void handleTogglePin(item)}
                      onEdit={handleOpenEdit}
                      onDelete={handleOpenDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            <section aria-label="All announcements">
              <div className="ann-section-label">
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>All Announcements</span>
              </div>

              {unpinnedList.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {unpinnedList.map((ann, idx) => (
                    <AnnouncementCard
                      key={ann.id}
                      announcement={ann}
                      delayMs={idx * 50}
                      pinning={pinningId === ann.id}
                      onTogglePin={(item) => void handleTogglePin(item)}
                      onEdit={handleOpenEdit}
                      onDelete={handleOpenDelete}
                    />
                  ))}
                </div>
              )}

              {/* Empty State (verbatim legacy wording when board is empty) */}
              {filtered.length === 0 && (
                <div className="px-5 py-20 text-center">
                  <Megaphone
                    className="mx-auto mb-3.5 h-14 w-14 opacity-20"
                    style={{ color: "var(--ann-text-primary)" }}
                    aria-hidden="true"
                  />
                  <h3
                    className="mb-1.5 text-[1rem] font-semibold"
                    style={{ color: "var(--ann-text-muted)" }}
                  >
                    {hasActiveFilter
                      ? "No matching announcements"
                      : "No announcements yet"}
                  </h3>
                  <p
                    className="text-[0.82rem]"
                    style={{ color: "var(--ann-text-faint)" }}
                  >
                    {hasActiveFilter
                      ? "Try clearing your search or choosing another category."
                      : 'Click "Post Announcement" to create the first one.'}
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {/* Create / Edit Modal */}
        <AnnouncementModal
          open={modalOpen}
          mode={editingId !== null ? "edit" : "create"}
          values={formValues}
          submitting={submitting}
          formError={formError}
          onChange={setFormValues}
          onClose={handleCloseModal}
          onSubmit={handleSubmitForm}
        />

        {/* Delete Confirmation Modal */}
        <DeleteAnnouncementModal
          open={deleteTarget !== null}
          title={deleteTarget?.title ?? ""}
          deleting={deleting}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />

        {/* Toast Notifications */}
        {toasts.length > 0 && (
          <div
            aria-live="polite"
            className="fixed bottom-[22px] right-[22px] z-[9999] flex max-w-[340px] flex-col gap-2"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className="ann-toast flex items-center gap-2.5 rounded-[11px] px-4 py-3 text-[0.84rem] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                style={{
                  backgroundColor: "var(--ann-toast-bg)",
                  border: `1px solid ${
                    t.type === "success"
                      ? "rgba(var(--accent2-rgb), 0.4)"
                      : "rgba(var(--danger-rgb), 0.4)"
                  }`,
                  color: "var(--ann-text-primary)",
                }}
              >
                {t.type === "success" ? (
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
    </StaffShell>
  );
}
