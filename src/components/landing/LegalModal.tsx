"use client";

import { Check, FileText, ShieldCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type LegalModalType = "privacy" | "terms" | null;

export function LegalModal({
  type,
  onClose,
}: {
  type: LegalModalType;
  onClose: () => void;
}) {
  const isPrivacy = type === "privacy";

  return (
    <Dialog open={type !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-[640px] flex-col p-0">
        <div className="flex shrink-0 items-center justify-between border-b border-white/7 px-6 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-[0.92rem] font-bold uppercase tracking-[0.06em] text-accent">
            {isPrivacy ? (
              <>
                <ShieldCheck className="h-4 w-4" /> Privacy Policy
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" /> Terms of Use
              </>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isPrivacy
              ? "Iloilo City Public Library Privacy Policy"
              : "Iloilo City Public Library Terms of Use"}
          </DialogDescription>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/7 text-white/55 transition hover:border-danger/25 hover:bg-danger/10 hover:text-danger cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 text-[0.84rem] leading-[1.8] text-white/58 space-y-3">
          {isPrivacy ? (
            <>
              <h5 className="text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                1. Introduction
              </h5>
              <p>
                The Iloilo City Public Library is committed to protecting the privacy and personal
                information of all library members and visitors.
              </p>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                2. Information We Collect
              </h5>
              <ul className="list-disc space-y-1 pl-5">
                <li>Full name, address, and contact details</li>
                <li>Membership and borrowing records</li>
                <li>Transaction history for borrowed and returned materials</li>
                <li>Event registrations and program participation records</li>
              </ul>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                3. How We Use Your Information
              </h5>
              <ul className="list-disc space-y-1 pl-5">
                <li>Managing your library membership account</li>
                <li>Processing book loans, renewals, and returns</li>
                <li>Sending notifications about due dates, events, and announcements</li>
                <li>Improving library services and programs for the community</li>
              </ul>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                4. Data Sharing
              </h5>
              <p>
                The library does not sell, trade, or share your personal information with third
                parties, except as required by law or authorized government agencies in compliance
                with the Data Privacy Act of 2012 (RA 10173).
              </p>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                5. Data Security
              </h5>
              <p>
                We implement appropriate technical and organizational measures to protect your
                personal data from unauthorized access, disclosure, alteration, or destruction.
              </p>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                6. Your Rights
              </h5>
              <p>
                As a data subject under the Data Privacy Act of 2012, you have the right to access,
                correct, and request deletion of your personal data held by the library.
              </p>
            </>
          ) : (
            <>
              <h5 className="text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                1. Acceptance of Terms
              </h5>
              <p>
                By accessing and using the Iloilo City Public Library&apos;s facilities, services,
                and online systems, you agree to comply with and be bound by these Terms of Use.
              </p>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                2. Library Membership
              </h5>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Membership is open to all residents and stakeholders of Iloilo City and Province.
                </li>
                <li>
                  Members are responsible for keeping their account information accurate and up to
                  date.
                </li>
                <li>
                  Membership cards are non-transferable and must be presented when borrowing
                  materials.
                </li>
              </ul>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                3. Borrowing Policies
              </h5>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Members may borrow materials for designated loan periods as set by library staff.
                </li>
                <li>Borrowed materials must be returned on or before their due dates.</li>
                <li>
                  Lost or damaged materials must be replaced or paid for at the library&apos;s
                  assessed value.
                </li>
              </ul>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                4. Library Premises and Conduct
              </h5>
              <ul className="list-disc space-y-1 pl-5">
                <li>All patrons are expected to maintain a quiet and respectful environment.</li>
                <li>Food and beverages are not permitted in designated reading areas.</li>
                <li>
                  The library reserves the right to deny access to individuals who violate conduct
                  policies.
                </li>
              </ul>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                5. Online System Use
              </h5>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  The library&apos;s online catalog and member portal are provided for authorized
                  library members only.
                </li>
                <li>Unauthorized access or misuse of the system is strictly prohibited.</li>
              </ul>

              <h5 className="pt-2 text-[0.82rem] font-bold tracking-[0.03em] text-white/85">
                6. Free WiFi and Computers
              </h5>
              <p>
                Free WiFi and computer access are provided for educational and informational
                purposes only.
              </p>
            </>
          )}
          <p className="pt-3 text-[0.77rem] text-white/30">
            Last updated: 2025 &nbsp;·&nbsp; Iloilo City Public Library
          </p>
        </div>

        <div className="flex shrink-0 justify-end border-t border-white/7 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-accent/25 bg-accent/15 px-5 py-2 text-[0.8rem] font-bold text-accent transition hover:bg-accent/25 hover:text-white cursor-pointer"
          >
            <Check className="h-4 w-4" /> I Understand
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
