"use client";

import { useState } from "react";
import { AtSign, Check, Circle, Phone, User, Users } from "lucide-react";
import type { PersonalSubTab } from "./types";

interface PersonalDetailsSectionProps {
  personalTab: PersonalSubTab;
  onChangePersonalTab: (tab: PersonalSubTab) => void;
  firstname: string;
  lastname: string;
  gender: string;
  phone: string;
  savedFirstname: string;
  savedLastname: string;
  savedGender: string;
  savedPhone: string;
  email: string;
  savingProfile: boolean;
  onChangeFirstname: (val: string) => void;
  onChangeLastname: (val: string) => void;
  onChangeGender: (val: string) => void;
  onChangePhone: (val: string) => void;
  onCommitProfile: () => Promise<boolean>;
}

const GENDER_OPTIONS = ["Male", "Female", "Others"] as const;

type EditableField = "firstName" | "lastName" | "gender" | "phone";

export function PersonalDetailsSection({
  personalTab,
  onChangePersonalTab,
  firstname,
  lastname,
  gender,
  phone,
  savedFirstname,
  savedLastname,
  savedGender,
  savedPhone,
  email,
  savingProfile,
  onChangeFirstname,
  onChangeLastname,
  onChangeGender,
  onChangePhone,
  onCommitProfile,
}: PersonalDetailsSectionProps) {
  const [editing, setEditing] = useState<Record<EditableField, boolean>>({
    firstName: false,
    lastName: false,
    gender: false,
    phone: false,
  });

  const toggleEdit = async (field: EditableField) => {
    if (!editing[field]) {
      setEditing((prev) => ({ ...prev, [field]: true }));
      return;
    }
    const ok = await onCommitProfile();
    if (ok) {
      setEditing((prev) => ({ ...prev, [field]: false }));
    }
  };

  const cancelEdit = (field: EditableField) => {
    if (field === "firstName") onChangeFirstname(savedFirstname);
    if (field === "lastName") onChangeLastname(savedLastname);
    if (field === "gender") onChangeGender(savedGender);
    if (field === "phone") onChangePhone(savedPhone);
    setEditing((prev) => ({ ...prev, [field]: false }));
  };

  const btnStyle = {
    backgroundColor: "rgba(var(--accent-rgb), 0.1)",
    border: "1px solid rgba(var(--accent-rgb), 0.2)",
    color: "var(--accent)",
  };

  const inputStyle = {
    backgroundColor: "var(--as-input-bg)",
    border: "1px solid rgba(var(--accent-rgb), 0.45)",
    color: "var(--as-text-primary)",
  };

  return (
    <section id="personal" aria-labelledby="personal-heading">
      <div className="mb-6">
        <h2
          id="personal-heading"
          className="mb-[5px] text-[1.45rem] font-bold tracking-[-0.03em]"
          style={{ color: "var(--as-text-primary)" }}
        >
          Personal <span style={{ color: "var(--accent)" }}>Details</span>
        </h2>
        <p className="text-[0.85rem]" style={{ color: "var(--as-text-secondary)" }}>
          Update your profile information.
        </p>
      </div>

      {/* Sub-tabs: Profile Info | Contact */}
      <div
        role="tablist"
        aria-label="Personal details tabs"
        className="mb-[22px] flex gap-1 rounded-[12px] p-1"
        style={{
          backgroundColor: "var(--as-tab-track)",
          border: "1px solid var(--as-border)",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={personalTab === "info"}
          onClick={() => onChangePersonalTab("info")}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-[7px] rounded-[9px] px-3 py-2 text-[0.82rem] font-semibold transition cursor-pointer"
          style={
            personalTab === "info"
              ? {
                  backgroundColor: "var(--as-active-bg)",
                  color: "var(--accent)",
                }
              : {
                  color: "var(--as-text-muted)",
                }
          }
        >
          <User className="h-3.5 w-3.5" aria-hidden="true" />
          Profile Info
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={personalTab === "contact"}
          onClick={() => onChangePersonalTab("contact")}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-[7px] rounded-[9px] px-3 py-2 text-[0.82rem] font-semibold transition cursor-pointer"
          style={
            personalTab === "contact"
              ? {
                  backgroundColor: "var(--as-active-bg)",
                  color: "var(--accent)",
                }
              : {
                  color: "var(--as-text-muted)",
                }
          }
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          Contact
        </button>
      </div>

      {/* Profile Info Panel */}
      {personalTab === "info" && (
        <div
          className="mb-[18px] overflow-hidden rounded-[16px]"
          style={{
            backgroundColor: "var(--as-card-bg)",
            border: "1px solid var(--as-border)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 pb-3 pt-3.5"
            style={{ borderBottom: "1px solid var(--as-border)" }}
          >
            <span
              className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-[0.07em]"
              style={{ color: "var(--accent)" }}
            >
              <User className="h-4 w-4" aria-hidden="true" />
              Basic Info
            </span>
          </div>

          {/* First Name */}
          <div
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-[13px]">
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                  color: "var(--accent)",
                }}
              >
                <User className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="as-first-name"
                  className="mb-0.5 block text-[0.88rem] font-semibold"
                  style={{ color: "var(--as-text-primary)" }}
                >
                  First Name
                </label>
                {editing.firstName ? (
                  <input
                    id="as-first-name"
                    type="text"
                    maxLength={64}
                    value={firstname}
                    onChange={(e) => onChangeFirstname(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void toggleEdit("firstName");
                      } else if (e.key === "Escape") {
                        cancelEdit("firstName");
                      }
                    }}
                    placeholder="First name"
                    autoFocus
                    className="mt-1 w-full max-w-[320px] rounded-lg px-[11px] py-[7px] text-[0.86rem]"
                    style={inputStyle}
                  />
                ) : (
                  <div className="text-[0.75rem]" style={{ color: "var(--as-text-muted)" }}>
                    {firstname || "—"}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => void toggleEdit("firstName")}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                style={btnStyle}
              >
                {editing.firstName ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Save
                  </>
                ) : (
                  "Edit"
                )}
              </button>
              {editing.firstName && (
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => cancelEdit("firstName")}
                  className="inline-flex min-h-[44px] items-center rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                  style={btnStyle}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Last Name */}
          <div
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-[13px]">
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                  color: "var(--accent)",
                }}
              >
                <User className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="as-last-name"
                  className="mb-0.5 block text-[0.88rem] font-semibold"
                  style={{ color: "var(--as-text-primary)" }}
                >
                  Last Name
                </label>
                {editing.lastName ? (
                  <input
                    id="as-last-name"
                    type="text"
                    maxLength={64}
                    value={lastname}
                    onChange={(e) => onChangeLastname(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void toggleEdit("lastName");
                      } else if (e.key === "Escape") {
                        cancelEdit("lastName");
                      }
                    }}
                    placeholder="Last name"
                    autoFocus
                    className="mt-1 w-full max-w-[320px] rounded-lg px-[11px] py-[7px] text-[0.86rem]"
                    style={inputStyle}
                  />
                ) : (
                  <div className="text-[0.75rem]" style={{ color: "var(--as-text-muted)" }}>
                    {lastname || "—"}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => void toggleEdit("lastName")}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                style={btnStyle}
              >
                {editing.lastName ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Save
                  </>
                ) : (
                  "Edit"
                )}
              </button>
              {editing.lastName && (
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => cancelEdit("lastName")}
                  className="inline-flex min-h-[44px] items-center rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                  style={btnStyle}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Gender */}
          <div
            className="px-5 pt-3.5"
            style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-[13px]">
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                  style={{
                    backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                    color: "var(--accent)",
                  }}
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <div
                    className="mb-0.5 text-[0.88rem] font-semibold"
                    style={{ color: "var(--as-text-primary)" }}
                  >
                    Gender
                  </div>
                  <div className="text-[0.75rem]" style={{ color: "var(--as-text-muted)" }}>
                    {gender || "—"}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => void toggleEdit("gender")}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                  style={btnStyle}
                >
                  {editing.gender ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Save
                    </>
                  ) : (
                    "Edit"
                  )}
                </button>
                {editing.gender && (
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={() => cancelEdit("gender")}
                    className="inline-flex min-h-[44px] items-center rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                    style={btnStyle}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pb-3.5 pl-0 sm:pl-[47px]">
              {GENDER_OPTIONS.map((opt) => {
                const selected = gender === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={!editing.gender}
                    onClick={() => onChangeGender(opt)}
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.82rem] font-semibold transition ${
                      editing.gender ? "cursor-pointer" : "cursor-default"
                    }`}
                    style={
                      selected
                        ? {
                            backgroundColor: "rgba(var(--accent-rgb), 0.18)",
                            border: "1px solid var(--accent)",
                            color: "var(--accent)",
                          }
                        : {
                            backgroundColor: "var(--as-input-bg)",
                            border: "1px solid var(--as-border)",
                            color: "var(--as-text-secondary)",
                          }
                    }
                  >
                    <Circle className="h-2.5 w-2.5" aria-hidden="true" />
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email / Username (Read-only) */}
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex min-w-0 flex-1 items-center gap-[13px]">
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                  color: "var(--accent)",
                }}
              >
                <AtSign className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div
                  className="mb-0.5 text-[0.88rem] font-semibold"
                  style={{ color: "var(--as-text-primary)" }}
                >
                  Email / Username
                </div>
                <div
                  className="truncate text-[0.75rem]"
                  style={{ color: "var(--as-text-muted)" }}
                >
                  {email || "—"}
                </div>
              </div>
            </div>
            <span
              className="shrink-0 whitespace-nowrap text-[0.74rem]"
              style={{ color: "var(--as-text-faint)" }}
            >
              Read-only
            </span>
          </div>
        </div>
      )}

      {/* Contact Panel */}
      {personalTab === "contact" && (
        <div
          className="mb-[18px] overflow-hidden rounded-[16px]"
          style={{
            backgroundColor: "var(--as-card-bg)",
            border: "1px solid var(--as-border)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 pb-3 pt-3.5"
            style={{ borderBottom: "1px solid var(--as-border)" }}
          >
            <span
              className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-[0.07em]"
              style={{ color: "var(--accent)" }}
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Contact
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex min-w-0 flex-1 items-center gap-[13px]">
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                  color: "var(--accent)",
                }}
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="as-phone-number"
                  className="mb-0.5 block text-[0.88rem] font-semibold"
                  style={{ color: "var(--as-text-primary)" }}
                >
                  Phone Number
                </label>
                {editing.phone ? (
                  <input
                    id="as-phone-number"
                    type="tel"
                    maxLength={20}
                    value={phone}
                    onChange={(e) => onChangePhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void toggleEdit("phone");
                      } else if (e.key === "Escape") {
                        cancelEdit("phone");
                      }
                    }}
                    placeholder="e.g. 0917 123 4567"
                    autoFocus
                    className="mt-1 w-full max-w-[320px] rounded-lg px-[11px] py-[7px] text-[0.86rem]"
                    style={inputStyle}
                  />
                ) : (
                  <div className="text-[0.75rem]" style={{ color: "var(--as-text-muted)" }}>
                    {phone || "—"}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => void toggleEdit("phone")}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                style={btnStyle}
              >
                {editing.phone ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Save
                  </>
                ) : (
                  "Edit"
                )}
              </button>
              {editing.phone && (
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => cancelEdit("phone")}
                  className="inline-flex min-h-[44px] items-center rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                  style={btnStyle}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
