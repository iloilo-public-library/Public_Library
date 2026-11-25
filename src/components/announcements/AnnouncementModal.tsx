"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Loader2,
  Megaphone,
  Radio,
  Search,
  Send,
  User,
  UserCheck,
  UserCircle2,
  X,
} from "lucide-react";
import type {
  AnnouncementCategory,
  AnnouncementFormValues,
  MemberPickerOption,
} from "./types";

interface AnnouncementModalProps {
  open: boolean;
  mode: "create" | "edit";
  values: AnnouncementFormValues;
  submitting: boolean;
  formError: string | null;
  onChange: (next: AnnouncementFormValues) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => Promise<void>;
  role?: "admin" | "librarian";
  canSendToMember?: boolean;
}

export function AnnouncementModal({
  open,
  mode,
  values,
  submitting,
  formError,
  onChange,
  onClose,
  onSubmit,
  canSendToMember = true,
}: AnnouncementModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const pickerWrapRef = useRef<HTMLDivElement | null>(null);

  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<MemberPickerOption[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeMemberIdx, setActiveMemberIdx] = useState<number>(-1);

  // Reset picker state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setMemberQuery("");
      setMemberResults([]);
      setDropdownOpen(false);
      setSearchingMembers(false);
      setActiveMemberIdx(-1);
    }
  }, [open]);

  // Debounced member search (280ms, matching legacy announcement.html)
  useEffect(() => {
    if (!open || mode !== "create") return;
    const q = memberQuery.trim();
    if (!q) {
      setMemberResults([]);
      setDropdownOpen(false);
      setSearchingMembers(false);
      return;
    }

    const controller = new AbortController();
    setSearchingMembers(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/users?role=member&limit=8&q=${encodeURIComponent(q)}`,
          { credentials: "same-origin", signal: controller.signal }
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          users?: MemberPickerOption[];
        };
        if (!controller.signal.aborted) {
          setMemberResults(Array.isArray(data.users) ? data.users : []);
          setActiveMemberIdx(-1);
          setDropdownOpen(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMemberResults([]);
          setDropdownOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchingMembers(false);
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [memberQuery, open, mode]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        pickerWrapRef.current &&
        !pickerWrapRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [dropdownOpen]);

  const stateRef = useRef({ dropdownOpen, submitting, onClose });
  stateRef.current = { dropdownOpen, submitting, onClose };

  // Focus trap & Escape handling (runs only when `open` transitions to true)
  useEffect(() => {
    if (!open) return;
    titleInputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (stateRef.current.dropdownOpen) {
          setDropdownOpen(false);
          return;
        }
        if (!stateRef.current.submitting) stateRef.current.onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const titleLen = values.title.length;
  const bodyLen = values.body.length;

  const inputStyle = {
    backgroundColor: "var(--ann-input-bg)",
    border: "1px solid var(--ann-input-border)",
    color: "var(--ann-text-primary)",
  };

  const handleSelectMember = (member: MemberPickerOption) => {
    onChange({
      ...values,
      target_user_id: member.id,
      target_user_name: member.fullname,
    });
    setMemberQuery("");
    setMemberResults([]);
    setDropdownOpen(false);
  };

  const handleClearMember = () => {
    onChange({
      ...values,
      target_user_id: null,
      target_user_name: null,
    });
    setMemberQuery("");
    setMemberResults([]);
    setDropdownOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ann-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-[20px] shadow-[0_28px_70px_rgba(0,0,0,0.55)]"
        style={{
          background: "var(--ann-modal-bg)",
          border: "1px solid var(--ann-modal-border)",
          color: "var(--ann-text-primary)",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-6 pb-4 pt-5"
          style={{ borderBottom: "1px solid var(--ann-border)" }}
        >
          <h2
            id="ann-modal-title"
            className="flex items-center gap-2.5 text-[1.05rem] font-bold"
          >
            <Megaphone
              className="h-5 w-5 shrink-0"
              style={{ color: "var(--accent)" }}
              aria-hidden="true"
            />
            <span>{mode === "edit" ? "Edit Announcement" : "New Announcement"}</span>
          </h2>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-11 w-11 items-center justify-center rounded-lg transition cursor-pointer disabled:opacity-40"
            style={{ color: "var(--ann-text-muted)" }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-[22px]">
            {formError && (
              <div
                role="alert"
                className="rounded-xl px-4 py-3 text-[0.82rem]"
                style={{
                  backgroundColor: "rgba(var(--danger-rgb), 0.12)",
                  border: "1px solid rgba(var(--danger-rgb), 0.35)",
                  color: "var(--danger)",
                }}
              >
                {formError}
              </div>
            )}

            {/* Title */}
            <div>
              <label
                htmlFor="ann-title-input"
                className="mb-[5px] block text-[0.78rem] font-semibold"
                style={{ color: "var(--tl)" }}
              >
                Title <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                ref={titleInputRef}
                id="ann-title-input"
                type="text"
                maxLength={120}
                value={values.title}
                onChange={(e) => onChange({ ...values, title: e.target.value })}
                placeholder="e.g. Library Holiday Schedule"
                className="min-h-[44px] w-full rounded-[9px] px-[13px] py-[9px] text-[0.88rem]"
                style={inputStyle}
              />
              <div
                className="mt-[3px] text-right text-[0.7rem]"
                style={{
                  color:
                    titleLen === 120
                      ? "var(--danger)"
                      : titleLen > 100
                      ? "var(--warn)"
                      : "var(--ann-text-faint)",
                }}
              >
                {titleLen} / 120
              </div>
            </div>

            {/* Category + Pin to top? */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ann-category-select"
                  className="mb-[5px] block text-[0.78rem] font-semibold"
                  style={{ color: "var(--tl)" }}
                >
                  Category
                </label>
                <select
                  id="ann-category-select"
                  value={values.category}
                  onChange={(e) =>
                    onChange({
                      ...values,
                      category: e.target.value as AnnouncementCategory,
                    })
                  }
                  className="min-h-[44px] w-full rounded-[9px] px-[13px] py-[9px] text-[0.88rem] cursor-pointer"
                  style={inputStyle}
                >
                  <option
                    value="general"
                    style={{ backgroundColor: "var(--modal-bg)", color: "var(--fg)" }}
                  >
                    📌 General
                  </option>
                  <option
                    value="urgent"
                    style={{ backgroundColor: "var(--modal-bg)", color: "var(--fg)" }}
                  >
                    🚨 Urgent
                  </option>
                  <option
                    value="event"
                    style={{ backgroundColor: "var(--modal-bg)", color: "var(--fg)" }}
                  >
                    🎉 Event
                  </option>
                  <option
                    value="reminder"
                    style={{ backgroundColor: "var(--modal-bg)", color: "var(--fg)" }}
                  >
                    ⏰ Reminder
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ann-pin-select"
                  className="mb-[5px] block text-[0.78rem] font-semibold"
                  style={{ color: "var(--tl)" }}
                >
                  Pin to top?
                </label>
                <select
                  id="ann-pin-select"
                  value={values.pinned ? "1" : "0"}
                  onChange={(e) =>
                    onChange({ ...values, pinned: e.target.value === "1" })
                  }
                  className="min-h-[44px] w-full rounded-[9px] px-[13px] py-[9px] text-[0.88rem] cursor-pointer"
                  style={inputStyle}
                >
                  <option
                    value="0"
                    style={{ backgroundColor: "var(--modal-bg)", color: "var(--fg)" }}
                  >
                    No — show in feed
                  </option>
                  <option
                    value="1"
                    style={{ backgroundColor: "var(--modal-bg)", color: "var(--fg)" }}
                  >
                    📌 Yes — pin
                  </option>
                </select>
              </div>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="ann-body-input"
                className="mb-[5px] block text-[0.78rem] font-semibold"
                style={{ color: "var(--tl)" }}
              >
                Message <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <textarea
                id="ann-body-input"
                maxLength={1000}
                rows={4}
                value={values.body}
                onChange={(e) => onChange({ ...values, body: e.target.value })}
                placeholder="Write your announcement here…"
                className="min-h-[110px] w-full resize-y rounded-[9px] px-[13px] py-[9px] text-[0.88rem]"
                style={inputStyle}
              />
              <div
                className="mt-[3px] text-right text-[0.7rem]"
                style={{
                  color:
                    bodyLen === 1000
                      ? "var(--danger)"
                      : bodyLen > 800
                      ? "var(--warn)"
                      : "var(--ann-text-faint)",
                }}
              >
                {bodyLen} / 1000
              </div>
            </div>

            {/* Send To (Live Member Picker on Create; Read-only on Edit) */}
            {canSendToMember && (
            <div ref={pickerWrapRef}>
              <label
                htmlFor="ann-send-to-input"
                className="mb-[5px] inline-flex items-center gap-1.5 text-[0.78rem] font-semibold"
                style={{ color: "var(--tl)" }}
              >
                <User
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--accent)" }}
                  aria-hidden="true"
                />
                Send To
              </label>

              {mode === "edit" ? (
                <div
                  className="flex min-h-[44px] items-center gap-2 rounded-[9px] px-3 py-2 text-[0.84rem]"
                  style={{
                    backgroundColor: "var(--ann-preview-bg)",
                    border: "1px solid var(--ann-border)",
                    color: "var(--ann-text-secondary)",
                  }}
                >
                  {values.target_user_id ? (
                    <>
                      <UserCheck
                        className="h-4 w-4 shrink-0"
                        style={{ color: "var(--accent)" }}
                        aria-hidden="true"
                      />
                      <span>
                        Sent to{" "}
                        <strong style={{ color: "var(--ann-text-primary)" }}>
                          {values.target_user_name || `Member #${values.target_user_id}`}
                        </strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <Radio
                        className="h-4 w-4 shrink-0"
                        style={{ color: "var(--ann-text-muted)" }}
                        aria-hidden="true"
                      />
                      <span>All members</span>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: "var(--ann-text-muted)" }}
                      aria-hidden="true"
                    />
                    <input
                      id="ann-send-to-input"
                      type="text"
                      role="combobox"
                      aria-expanded={dropdownOpen}
                      aria-controls="ann-member-listbox"
                      aria-autocomplete="list"
                      aria-activedescendant={
                        dropdownOpen &&
                        activeMemberIdx >= 0 &&
                        memberResults[activeMemberIdx]
                          ? `ann-member-opt-${memberResults[activeMemberIdx].id}`
                          : undefined
                      }
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      onFocus={() => {
                        if (memberQuery.trim() && memberResults.length > 0) {
                          setDropdownOpen(true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!dropdownOpen) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          if (memberResults.length > 0) {
                            setActiveMemberIdx((prev) =>
                              prev < memberResults.length - 1 ? prev + 1 : 0
                            );
                          }
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          if (memberResults.length > 0) {
                            setActiveMemberIdx((prev) =>
                              prev > 0 ? prev - 1 : memberResults.length - 1
                            );
                          }
                        } else if (e.key === "Enter") {
                          if (activeMemberIdx >= 0 && memberResults[activeMemberIdx]) {
                            e.preventDefault();
                            handleSelectMember(memberResults[activeMemberIdx]);
                          }
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropdownOpen(false);
                          setActiveMemberIdx(-1);
                        }
                      }}
                      placeholder="Search user by name… (leave empty to send to all)"
                      autoComplete="off"
                      className="min-h-[44px] w-full rounded-[9px] py-[9px] pl-9 pr-9 text-[0.88rem]"
                      style={inputStyle}
                    />
                    {searchingMembers && (
                      <Loader2
                        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
                        style={{ color: "var(--accent)" }}
                        aria-hidden="true"
                      />
                    )}

                    {dropdownOpen && (
                      <div
                        id="ann-member-listbox"
                        role="listbox"
                        aria-label="Matching members"
                        className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-[200px] overflow-y-auto rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                        style={{
                          backgroundColor: "var(--modal-bg)",
                          border: "1px solid var(--ann-modal-border)",
                        }}
                      >
                        {memberResults.length === 0 ? (
                          <div
                            className="px-3.5 py-2.5 text-[0.84rem]"
                            style={{ color: "var(--ann-text-muted)" }}
                          >
                            No users found
                          </div>
                        ) : (
                          memberResults.map((member, idx) => {
                            const isHighlighted = idx === activeMemberIdx;
                            return (
                              <button
                                key={member.id}
                                id={`ann-member-opt-${member.id}`}
                                type="button"
                                role="option"
                                aria-selected={
                                  isHighlighted || values.target_user_id === member.id
                                }
                                onMouseEnter={() => setActiveMemberIdx(idx)}
                                onClick={() => handleSelectMember(member)}
                                className={`flex min-h-[44px] w-full items-center gap-2.5 px-3.5 py-2 text-left text-[0.84rem] transition cursor-pointer hover:bg-accent/10 ${
                                  isHighlighted ? "bg-accent/15" : ""
                                }`}
                                style={{
                                  borderBottom: "1px solid var(--ann-border)",
                                  color: "var(--ann-text-primary)",
                                }}
                              >
                                <UserCircle2
                                  className="h-4 w-4 shrink-0"
                                  style={{ color: "var(--accent)" }}
                                  aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-semibold">
                                    {member.fullname}
                                  </div>
                                  {member.library_card_number && (
                                    <div
                                      className="font-mono text-[0.72rem]"
                                      style={{ color: "var(--ann-text-muted)" }}
                                    >
                                      {member.library_card_number}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {values.target_user_id ? (
                    <div
                      className="mt-1.5 flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[0.82rem]"
                      style={{
                        backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                        border: "1px solid rgba(var(--accent-rgb), 0.25)",
                      }}
                    >
                      <UserCheck
                        className="h-4 w-4 shrink-0"
                        style={{ color: "var(--accent)" }}
                        aria-hidden="true"
                      />
                      <span
                        className="flex-1 truncate font-semibold"
                        style={{ color: "var(--accent)" }}
                      >
                        {values.target_user_name || `Member #${values.target_user_id}`}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearMember}
                        title="Remove — send to all"
                        aria-label="Remove recipient — send to all"
                        className="flex h-11 w-11 items-center justify-center rounded-md transition cursor-pointer hover:text-danger"
                        style={{ color: "var(--ann-text-muted)" }}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="mt-1.5 flex items-center gap-1.5 text-[0.75rem]"
                      style={{ color: "var(--ann-text-faint)" }}
                    >
                      <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        No user selected — this will be sent to all members
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            )}

            {/* Live Preview */}
            <div>
              <div
                className="mb-[5px] text-[0.78rem] font-semibold"
                style={{ color: "var(--tl)" }}
              >
                Preview
              </div>
              <div
                className="min-h-[50px] whitespace-pre-wrap rounded-[9px] px-[15px] py-[13px] text-[0.82rem]"
                style={{
                  backgroundColor: "var(--ann-preview-bg)",
                  border: "1px dashed var(--ann-border-hover)",
                  color: values.body
                    ? "var(--ann-text-secondary)"
                    : "var(--ann-text-faint)",
                }}
              >
                {values.body || "Your message will appear here…"}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex shrink-0 items-center justify-end gap-2.5 px-6 py-4"
            style={{ borderTop: "1px solid var(--ann-border)" }}
          >
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-[44px] rounded-full px-5 py-2 text-[0.88rem] font-semibold transition cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: "var(--ann-pill-bg)",
                border: "1px solid var(--ann-pill-border)",
                color: "var(--ann-text-secondary)",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 py-2 text-[0.88rem] font-bold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--on-accent)",
              }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{mode === "edit" ? "Save Changes" : "Post"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
