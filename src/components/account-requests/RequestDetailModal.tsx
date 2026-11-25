"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Info,
  Loader2,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import {
  type AccountRequestRow,
  fmtDate,
  getDisplayName,
  getRequestTypeLabel,
  timeAgo,
} from "./types";

interface RequestDetailModalProps {
  row: AccountRequestRow | null;
  role?: "admin" | "librarian";
  canApprove?: boolean;
  canReject?: boolean;
  canViewValidId?: boolean;
  onClose: () => void;
  onApprove: (row: AccountRequestRow) => void;
  onReject: (row: AccountRequestRow) => void;
}

export function RequestDetailModal({
  row,
  role = "admin",
  canApprove = true,
  canReject = true,
  canViewValidId = true,
  onClose,
  onApprove,
  onReject,
}: RequestDetailModalProps) {
  const isLibrarian = role === "librarian";
  const allowProfileTab = !isLibrarian && canViewValidId;
  const [activeTab, setActiveTab] = useState<"request" | "profile">("request");
  const [idImgState, setIdImgState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!row) return;
    setActiveTab("request");
    setIdImgState("idle");
  }, [row?.id]);

  // Trigger loading state only when Full Profile tab is open and user has a valid_id_path
  useEffect(() => {
    if (!row || !allowProfileTab || activeTab !== "profile" || !row.valid_id_path) return;
    setIdImgState("loading");
  }, [row?.id, row?.valid_id_path, activeTab, allowProfileTab]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const rowId = row?.id ?? null;

  // Escape key & focus trap (runs only when modal opens or switches to a different request ID)
  useEffect(() => {
    if (rowId === null) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      prevFocused?.focus();
    };
  }, [rowId]);

  if (!row) return null;

  const isReg = row.request_type === "register";
  const isRenew = row.request_type === "renew";
  const displayName = getDisplayName(row);
  const typeLabel = getRequestTypeLabel(row.request_type);
  const locationText = [row.city, row.province].filter(Boolean).join(", ") || "—";
  const validIdUrl = allowProfileTab && row.valid_id_path ? `/api/admin/valid-id/${row.user_id}` : null;

  const statusColor =
    row.status === "pending"
      ? "var(--req-warn)"
      : row.status === "approved"
        ? "var(--req-accent2)"
        : "var(--req-danger)";

  const TypeIcon =
    row.request_type === "register"
      ? UserPlus
      : row.request_type === "renew"
        ? RefreshCw
        : row.request_type === "deactivate"
          ? PauseCircle
          : Trash2;

  const typeIconColor =
    row.request_type === "register"
      ? "var(--req-reg)"
      : row.request_type === "renew"
        ? "var(--req-renew)"
        : row.request_type === "deactivate"
          ? "var(--req-warn)"
          : "var(--req-danger)";

  return (
    <div
      className="req-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="req-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-detail-title"
        tabIndex={-1}
      >
        <div className="req-modal-header">
          <h2
            id="req-detail-title"
            className="req-modal-title"
            style={isLibrarian ? { color: "var(--req-renew, #a78bfa)" } : undefined}
          >
            {isLibrarian ? (
              <>
                <FileText className="h-4 w-4" style={{ color: "var(--req-renew, #a78bfa)" }} aria-hidden="true" />
                Renewal Request Details
              </>
            ) : (
              <>
                <Info className="h-4 w-4" style={{ color: "var(--req-accent)" }} aria-hidden="true" />
                Request Details
              </>
            )}
          </h2>
          <button
            type="button"
            className="req-modal-close"
            onClick={onClose}
            aria-label="Close request details"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="req-modal-body">
          {allowProfileTab && (
            <div className="req-dtab-bar" role="tablist" aria-label="Request details sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "request"}
                className={`req-dtab-btn ${activeTab === "request" ? "active" : ""}`}
                onClick={() => setActiveTab("request")}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Request
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "profile"}
                className={`req-dtab-btn ${activeTab === "profile" ? "active" : ""}`}
                onClick={() => setActiveTab("profile")}
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> Full Profile
              </button>
            </div>
          )}

          {!allowProfileTab || activeTab === "request" ? (
            <div role={allowProfileTab ? "tabpanel" : undefined}>
              <div className="req-detail-row">
                <div className="req-detail-lbl">Full Name</div>
                <div className="req-detail-val">{displayName}</div>
              </div>
              <div className="req-detail-row">
                <div className="req-detail-lbl">Email</div>
                <div className="req-detail-val req-detail-mono">{row.username}</div>
              </div>
              {!isLibrarian && (
                <div className="req-detail-row">
                  <div className="req-detail-lbl">Request</div>
                  <div className="req-detail-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <TypeIcon className="h-4 w-4" style={{ color: typeIconColor }} aria-hidden="true" />
                    <span>{typeLabel}</span>
                  </div>
                </div>
              )}
              <div className="req-detail-row">
                <div className="req-detail-lbl">Status</div>
                <div
                  className="req-detail-val"
                  style={{ color: statusColor, fontWeight: 700, textTransform: "capitalize" }}
                >
                  {row.status}
                </div>
              </div>
              <div className="req-detail-row">
                <div className="req-detail-lbl">Submitted</div>
                <div className="req-detail-val">
                  {fmtDate(row.created_at)}{" "}
                  {row.created_at && (
                    <span style={{ color: "var(--req-text-faint)", fontSize: "0.77rem" }}>
                      ({timeAgo(row.created_at)})
                    </span>
                  )}
                </div>
              </div>

              <hr className="req-modal-div" />

              {isReg && (
                <div className="req-reg-box">
                  <div className="req-reg-box-title">
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> New Account Registration
                  </div>
                  <p>
                    This user signed up and is waiting for your approval. Approving will activate
                    their account and notify them.
                  </p>
                </div>
              )}

              {isRenew && (
                <div className="req-renew-box">
                  <div className="req-renew-box-title">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Renewal Details — Card #
                    {row.card_id || "—"}
                  </div>
                  <div className="req-rdb-grid">
                    <div className="req-rdb-cell">
                      <label>1st Renewal</label>
                      <span>
                        {row.renewal1_checked ? fmtDate(row.renewal1_date) : "Not requested"}
                      </span>
                    </div>
                    <div className="req-rdb-cell">
                      <label>2nd Renewal</label>
                      <span>
                        {row.renewal2_checked ? fmtDate(row.renewal2_date) : "Not requested"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="req-fg-lbl">
                {isRenew
                  ? "Reason for Renewal"
                  : isReg
                    ? "Registration Note"
                    : "Reason Provided"}
              </div>
              <div className="req-detail-reason">{row.reason || (isLibrarian ? "—" : "No reason provided.")}</div>

              {row.admin_note && (
                <>
                  <hr className="req-modal-div" />
                  <div className="req-fg-lbl">{isLibrarian ? "Note" : "Admin Note"}</div>
                  <div
                    className="req-detail-reason"
                    style={{
                      borderColor: isLibrarian
                        ? "rgba(167, 139, 250, 0.24)"
                        : "rgba(159, 193, 225, 0.24)",
                    }}
                  >
                    {row.admin_note}
                  </div>
                </>
              )}

              {row.reviewed_at && (
                <div className="req-detail-row" style={{ marginTop: 14 }}>
                  <div className="req-detail-lbl">Reviewed</div>
                  <div className="req-detail-val" style={{ fontSize: "0.79rem", color: "var(--req-text-muted)" }}>
                    {fmtDate(row.reviewed_at)} ({timeAgo(row.reviewed_at)})
                  </div>
                </div>
              )}

              {row.status === "pending" && (canApprove || canReject) && (
                <>
                  <hr className="req-modal-div" />
                  <div className="req-modal-act-row">
                    {canApprove && (
                      <button
                        type="button"
                        className="req-btn-approve"
                        style={{ flex: 1 }}
                        onClick={() => {
                          onClose();
                          onApprove(row);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve
                      </button>
                    )}
                    {canReject && (
                      <button
                        type="button"
                        className="req-btn-reject"
                        style={{ flex: 1 }}
                        onClick={() => {
                          onClose();
                          onReject(row);
                        }}
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div role="tabpanel">
              <div className="req-profile-grid">
                <div className="req-profile-cell">
                  <div className="req-profile-cell-lbl">First Name</div>
                  <div className={`req-profile-cell-val ${row.firstname ? "" : "muted"}`}>
                    {row.firstname || "Not provided"}
                  </div>
                </div>
                <div className="req-profile-cell">
                  <div className="req-profile-cell-lbl">Last Name</div>
                  <div className={`req-profile-cell-val ${row.lastname ? "" : "muted"}`}>
                    {row.lastname || "Not provided"}
                  </div>
                </div>
              </div>

              <div className="req-detail-row">
                <div className="req-detail-lbl">Email</div>
                <div className="req-detail-val req-detail-mono">{row.email || row.username || "—"}</div>
              </div>
              <div className="req-detail-row">
                <div className="req-detail-lbl">Gender</div>
                <div className="req-detail-val">
                  {row.gender || <span style={{ color: "var(--req-text-faint)", fontStyle: "italic" }}>Not provided</span>}
                </div>
              </div>
              <div className="req-detail-row">
                <div className="req-detail-lbl">Phone</div>
                <div className="req-detail-val">
                  {row.phone_number || <span style={{ color: "var(--req-text-faint)", fontStyle: "italic" }}>Not provided</span>}
                </div>
              </div>
              <div className="req-detail-row">
                <div className="req-detail-lbl">Location</div>
                <div className="req-detail-val">{locationText}</div>
              </div>

              <hr className="req-modal-div" />
              <div className="req-section-subhead">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> Education &amp; Occupation
              </div>
              <div className="req-profile-grid">
                <div className="req-profile-cell">
                  <div className="req-profile-cell-lbl">School / Organization</div>
                  <div className={`req-profile-cell-val ${row.school ? "" : "muted"}`}>
                    {row.school || "Not provided"}
                  </div>
                </div>
                <div className="req-profile-cell">
                  <div className="req-profile-cell-lbl">Education Level</div>
                  <div className={`req-profile-cell-val ${row.education_level ? "" : "muted"}`}>
                    {row.education_level || "Not provided"}
                  </div>
                </div>
                <div className="req-profile-cell">
                  <div className="req-profile-cell-lbl">Occupation</div>
                  <div className={`req-profile-cell-val ${row.occupation ? "" : "muted"}`}>
                    {row.occupation || "Not provided"}
                  </div>
                </div>
                <div className="req-profile-cell">
                  <div className="req-profile-cell-lbl">Government Employee</div>
                  <div
                    className={`req-profile-cell-val ${row.is_government ? "" : "muted"}`}
                    style={row.is_government ? { color: "var(--req-accent2)" } : undefined}
                  >
                    {row.is_government ? "Yes" : "No"}
                  </div>
                </div>
              </div>
              {row.office_phone && (
                <div className="req-detail-row">
                  <div className="req-detail-lbl">Office Phone</div>
                  <div className="req-detail-val">{row.office_phone}</div>
                </div>
              )}

              <hr className="req-modal-div" />
              <div className="req-section-subhead">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verification &amp; Account
              </div>
              <div className="req-detail-row">
                <div className="req-detail-lbl">Valid ID</div>
                <div className="req-detail-val">
                  {row.valid_id_path ? (
                    <span className="req-id-pill has-id">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> ID on file
                    </span>
                  ) : (
                    <span className="req-id-pill no-id">
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> No ID uploaded
                    </span>
                  )}

                  {validIdUrl && (
                    <div className="req-valid-id-box">
                      {idImgState === "loading" && (
                        <div className="req-valid-id-status">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading protected ID document…
                          </span>
                        </div>
                      )}

                      {idImgState === "error" && (
                        <div className="req-valid-id-status">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--req-warn)" }}>
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            Preview unavailable (PDF or storage unreachable).
                          </span>
                        </div>
                      )}

                      {idImgState !== "error" && (
                        <img
                          src={validIdUrl}
                          alt={`Valid ID submitted by ${displayName}`}
                          className="req-valid-id-img"
                          style={{ display: idImgState === "loaded" ? "block" : "none" }}
                          onLoad={() => setIdImgState("loaded")}
                          onError={() => setIdImgState("error")}
                        />
                      )}

                      <div className="req-valid-id-status">
                        <span>Protected staff-only document</span>
                        <a
                          href={validIdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: "var(--req-accent)",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          Open in new tab <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="req-detail-row">
                <div className="req-detail-lbl">Submitted</div>
                <div className="req-detail-val" style={{ fontSize: "0.79rem", color: "var(--req-text-muted)" }}>
                  {fmtDate(row.created_at)}{" "}
                  {row.created_at && (
                    <span style={{ color: "var(--req-text-faint)", fontSize: "0.75rem" }}>
                      ({timeAgo(row.created_at)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
