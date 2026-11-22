"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme !== "light";

  return (
    <LibraryTooltip label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[9px] border border-white/12 bg-white/6 text-accent transition hover:border-accent/40 hover:bg-accent/15 cursor-pointer",
          className
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.span
              key="sun"
              initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 60, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center"
            >
              <Sun className="h-[17px] w-[17px] text-[#f5c842]" />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ opacity: 0, rotate: 60, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -60, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center"
            >
              <Moon className="h-[17px] w-[17px] text-accent" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </LibraryTooltip>
  );
}
