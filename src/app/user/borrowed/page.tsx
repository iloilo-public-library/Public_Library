"use client";

import Link from "next/link";
import { BookmarkCheck, BookOpen } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { Button } from "@/components/ui/button";

export default function UserBorrowedPage() {
  return (
    <MemberShell>
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
          My <span className="text-accent">Borrowed Books</span>
        </h1>
        <p className="mt-1 text-sm text-tl/80">
          Track active loans, due dates, and library card renewal eligibility.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card-glass p-12 text-center">
        <BookmarkCheck className="mx-auto mb-3 h-10 w-10 text-accent/55" />
        <h2 className="text-base font-bold text-white">No Active Borrowed Books</h2>
        <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-relaxed text-tl/75">
          Books checked out using your Iloilo City Public Library card will appear here with due
          dates and renewal options.
        </p>
        <Button variant="accent" size="sm" className="mt-5" asChild>
          <Link href="/user/browse">
            <BookOpen className="h-4 w-4" /> Browse Catalog
          </Link>
        </Button>
      </div>
    </MemberShell>
  );
}
