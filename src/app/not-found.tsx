"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Compass, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 0.68, 0, 1] }}
        className="relative w-full max-w-[540px] overflow-hidden rounded-[24px] border border-accent/20 bg-card-glass p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-12"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent via-accent2 to-transparent" />

        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/25 bg-accent/12 text-accent">
          <Compass className="h-8 w-8" />
        </div>

        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3.5 py-1 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent uppercase">
          ERR // 404 · PAGE NOT FOUND
        </div>

        <h1 className="mb-3 text-[clamp(2rem,5vw,3rem)] font-bold leading-none tracking-[-0.03em] text-white">
          404 <span className="text-accent">Missing Shelf</span>
        </h1>

        <p className="mx-auto mb-8 max-w-[400px] text-[0.88rem] leading-[1.7] text-tl/80">
          The page or section you&apos;re looking for doesn&apos;t exist or may have been moved
          during our Next.js &amp; Supabase upgrade.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button variant="accent" size="md" asChild>
            <Link href="/">
              <Home className="h-4 w-4" /> Home
            </Link>
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="md" asChild>
            <Link href="/browse">
              <BookOpen className="h-4 w-4" /> Browse Catalog
            </Link>
          </Button>
        </div>

        <div className="mt-7 border-t border-white/8 pt-5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-white/50 transition hover:text-accent cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Go back to previous page
          </button>
        </div>
      </motion.div>
    </main>
  );
}
