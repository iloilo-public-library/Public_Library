"use client";

import { useState, type ReactNode } from "react";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { StaffTopbar } from "@/components/layout/StaffTopbar";
import { cn } from "@/lib/utils";

interface StaffShellProps {
  title: string;
  role?: "admin" | "librarian";
  children: ReactNode;
}

export function StaffShell({ title, role = "admin", children }: StaffShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <StaffSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        role={role}
      />
      <StaffTopbar
        title={title}
        collapsed={collapsed}
        onOpenMobile={() => setMobileOpen(true)}
      />

      <main
        className={cn(
          "px-4 pb-16 pt-[76px] transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:px-8",
          collapsed ? "lg:pl-[88px]" : "lg:pl-[264px]"
        )}
      >
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
