"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { AdminFooter } from "@/components/layout/AdminFooter";
import { LibrarianFooter } from "@/components/layout/LibrarianFooter";
import { cn } from "@/lib/utils";

interface StaffShellProps {
  title: string;
  role?: "admin" | "librarian";
  children: ReactNode;
}

export function StaffShell({ role = "admin", children }: StaffShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = role === "admin";

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-clip">
      <StaffSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        role={role}
      />

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        className="fixed left-3 top-3 z-[1050] flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/12 bg-topbar/90 text-white/85 shadow-lg backdrop-blur-md transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden cursor-pointer"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <main
        className={cn(
          "flex-1 px-4 pb-16 pt-16 transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:px-8 lg:pt-8",
          collapsed ? "lg:pl-[88px]" : "lg:pl-[264px]"
        )}
      >
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>

      {isAdmin ? <AdminFooter collapsed={collapsed} /> : <LibrarianFooter collapsed={collapsed} />}
    </div>
  );
}
