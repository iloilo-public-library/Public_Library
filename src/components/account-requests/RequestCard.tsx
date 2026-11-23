"use client";

import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Hourglass,
  MessageSquareText,
  PauseCircle,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import {
  type AccountRequestRow,
  fmtDate,
  getDisplayName,
  getInitials,
  getRequestTypeLabel,
  timeAgo,
} from "./types";

interface RequestCardProps {
  row: AccountRequestRow;
  onViewDetail: (row: AccountRequestRow) => void;
  onApprove: (row: AccountRequestRow) => void;
  onReject: (row: AccountRequestRow) => void;
  onDeleteRecord: (row: AccountRequestRow) => void;
}

export function RequestCard({
  row,
  onViewDetail,
  onApprove,
  onReject,
  onDeleteRecord,
}: RequestCardProps) {
  const isReg = row.request_type === "register";
  const isRenew = row.request_type === "renew";
  const isDeact = row.request_type === "deactivate";

  const cardClass = isReg
    ? "card-reg"
    : isRenew
      ? "card-renew"
      : isDeact
        ? "card-deact"
        : "card-delete";

  const avClass = isReg
    ? "av-reg"
    : isRenew
      ? "av-renew"
      : isDeact
        ? "av-deact"
        : "av-delete";

  const displayName = getDisplayName(row);
  const initials = getInitials(displayName);
  const typeLabel = getRequestTypeLabel(row.request_type);
  const reasonSnip = row.reason
    ? `${row.reason.slice(0, 80)}${row.reason.length > 80 ? "…" : ""}`
    : "—";

  const TypeIcon = isReg
    ? UserPlus
    : isRenew
      ? RefreshCw
      : isDeact
        ? PauseCircle
        : Trash2;

  return (
    <article className={`id-card ${cardClass}`} aria-label={`${typeLabel} request from ${displayName}`}>
      <div className="card-strip" aria-hidden="true" />
      <div className="id-card-inner">
        <div className="id-card-top">
          <div className={`id-avatar ${avClass}`} aria-hidden="true">
            {initials}
          </div>
          <div className="id-info">
            <div className="id-name" title={displayName}>
              {displayName}
            </div>
            <div className="id-email" title={row.username}>
              {row.username}
            </div>
            <div className="id-status-wrap">
              {row.status === "pending" && (
                <span className="status-badge sb-pending">
                  <Hourglass className="h-3 w-3" aria-hidden="true" /> Pending
                </span>
              )}
              {row.status === "approved" && (
                <span className="status-badge sb-approved">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Approved
                </span>
              )}
              {row.status === "rejected" && (
                <span className="status-badge sb-rejected">
                  <XCircle className="h-3 w-3" aria-hidden="true" /> Rejected
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="id-meta">
          <div className="id-meta-row">
            <TypeIcon className="id-meta-icon h-3.5 w-3.5" aria-hidden="true" />
            <span className="id-meta-val">{typeLabel}</span>
          </div>
          <div className="id-meta-row">
            <MessageSquareText className="id-meta-icon h-3.5 w-3.5" aria-hidden="true" />
            <span className="id-meta-val">{reasonSnip}</span>
          </div>
        </div>

        {isRenew && (
          <div className="renew-mini">
            <div className="renew-mini-title">
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> Card #{row.card_id || "—"}
            </div>
            {row.renewal1_checked && (
              <span>• 1st renewal: {fmtDate(row.renewal1_date)}</span>
            )}
            {row.renewal2_checked && (
              <span>• 2nd renewal: {fmtDate(row.renewal2_date)}</span>
            )}
          </div>
        )}
      </div>

      <div className="id-card-foot">
        <div className="id-date">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {fmtDate(row.created_at)}
            {row.created_at ? ` · ${timeAgo(row.created_at)}` : ""}
          </span>
        </div>

        {row.status === "pending" ? (
          <div className="id-actions">
            <button
              type="button"
              className="btn-icon-act btn-approve-sm"
              onClick={() => onApprove(row)}
              aria-label={`Approve request for ${displayName}`}
              title="Approve"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn-icon-act btn-reject-sm"
              onClick={() => onReject(row)}
              aria-label={`Reject request for ${displayName}`}
              title="Reject"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn-view-detail"
              onClick={() => onViewDetail(row)}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Details
            </button>
          </div>
        ) : (
          <div className="id-actions">
            {row.reviewed_at && (
              <span className="reviewed-note" title={`Reviewed ${fmtDate(row.reviewed_at)}`}>
                <Clock className="h-3 w-3" aria-hidden="true" />
                {timeAgo(row.reviewed_at)}
              </span>
            )}
            <button
              type="button"
              className="btn-view-detail"
              onClick={() => onViewDetail(row)}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Details
            </button>
            <button
              type="button"
              className="btn-icon-act btn-delete-record"
              onClick={() => onDeleteRecord(row)}
              aria-label={`Delete record for ${displayName}`}
              title="Delete this record"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
