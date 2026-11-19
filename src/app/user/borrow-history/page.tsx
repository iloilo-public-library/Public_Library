"use client";

import { History } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";

export default function UserBorrowHistoryPage() {
  return (
    <MemberShell>
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
          Borrowing <span className="text-accent">History</span>
        </h1>
        <p className="mt-1 text-sm text-tl/80">
          Archive of your previously borrowed and returned library materials.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card-glass p-12 text-center">
        <History className="mx-auto mb-3 h-10 w-10 text-accent/55" />
        <h2 className="text-base font-bold text-white">No Past Return Records Yet</h2>
        <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-relaxed text-tl/75">
          Completed returns processed by library staff will be logged here automatically.
        </p>
      </div>
    </MemberShell>
  );
}
