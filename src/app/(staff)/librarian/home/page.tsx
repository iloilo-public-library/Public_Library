"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeftRight, BookOpen, CalendarDays, Users } from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { swrPrivateConfig } from "@/lib/api";
import type { DashboardStats } from "@/types/library";
import { OwlHeroVisual } from "@/components/home/OwlHeroVisual";
import "@/components/home/librarian-home.css";

export default function LibrarianHomePage() {
  const {
    data: stats,
    error: statsError,
    isLoading: statsLoading,
    mutate: retryStats,
  } = useSWR<DashboardStats>("/api/dashboard/stats", swrPrivateConfig);

  const totalBooks = typeof stats?.total_books === "number" ? stats.total_books : null;
  const availableBooks = typeof stats?.available_books === "number" ? stats.available_books : null;
  const totalUsers = typeof stats?.total_users === "number" ? stats.total_users : null;
  const overdueBooks = typeof stats?.overdue_books === "number" ? stats.overdue_books : null;

  return (
    <StaffShell title="Home" role="librarian">
      <div className="librarian-home-page">
        <section className="lh-hero" aria-label="Librarian home overview">
          <div className="lh-hero-inner">
            {/* TOP ROW */}
            <div className="lh-top-row">
              {/* Left: brand + headline + CTAs */}
              <div className="lh-left">
                <div className="lh-badge">
                  <span className="lh-badge-dot" aria-hidden="true" />
                  Dr. Graciano Lopez Jaena Learning Resource Center
                </div>

                <h1 className="lh-title">
                  Iloilo Public
                  <br />
                  <span>Library</span>
                </h1>

                <p className="lh-subtitle">
                  Manage collections, assist members, and keep the library running smoothly — all
                  from one place.
                </p>

                <div className="lh-cta-row">
                  <Link href="/librarian/books" className="lh-cta">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    Manage Books
                  </Link>
                  <Link href="/librarian/users" className="lh-cta-ghost">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    View Members
                  </Link>
                </div>
              </div>

              {/* Right: Owl visual + Overdue alert card */}
              <OwlHeroVisual
                overdueCount={overdueBooks}
                loadingOverdue={statsLoading}
                overdueError={Boolean(statsError)}
              />
            </div>

            {/* QUICK-ACTION CARD GRID */}
            <nav className="lh-card-grid" aria-label="Quick librarian shortcuts">
              <Link href="/librarian/books" className="lh-quick-card">
                <BookOpen
                  className="lh-qc-icon h-5 w-5"
                  style={{ color: "#9fc1e1" }}
                  aria-hidden="true"
                />
                <div className="lh-qc-name">Book Catalog</div>
                <div className="lh-qc-sub">
                  {statsLoading
                    ? "Loading…"
                    : totalBooks !== null
                      ? `${totalBooks.toLocaleString()} titles`
                      : "— titles"}
                </div>
              </Link>

              <Link href="/librarian/users" className="lh-quick-card">
                <Users
                  className="lh-qc-icon h-5 w-5"
                  style={{ color: "#48c78e" }}
                  aria-hidden="true"
                />
                <div className="lh-qc-name">Members</div>
                <div className="lh-qc-sub">
                  {statsLoading
                    ? "Loading…"
                    : totalUsers !== null
                      ? `${totalUsers.toLocaleString()} registered`
                      : "— registered"}
                </div>
              </Link>

              <Link href="/librarian/library-cards" className="lh-quick-card">
                <ArrowLeftRight
                  className="lh-qc-icon h-5 w-5"
                  style={{ color: "#ffb74d" }}
                  aria-hidden="true"
                />
                <div className="lh-qc-name">Borrowing</div>
                <div className="lh-qc-sub">Checkouts &amp; returns</div>
              </Link>

              <Link href="/librarian/calendar" className="lh-quick-card">
                <CalendarDays
                  className="lh-qc-icon h-5 w-5"
                  style={{ color: "#5ed3c8" }}
                  aria-hidden="true"
                />
                <div className="lh-qc-name">Events</div>
                <div className="lh-qc-sub">Upcoming calendar</div>
              </Link>
            </nav>

            {/* STATS ROW */}
            <div className="lh-stats" aria-label="Library catalog summary">
              <div>
                <div className="lh-stat-val">
                  {statsLoading ? (
                    <span className="lh-skel-inline" aria-label="Loading books count" />
                  ) : totalBooks !== null ? (
                    totalBooks.toLocaleString()
                  ) : (
                    "—"
                  )}
                </div>
                <div className="lh-stat-lbl">Books in Catalog</div>
              </div>

              <div className="lh-stat-divider" aria-hidden="true" />

              <div>
                <div className="lh-stat-val">
                  {statsLoading ? (
                    <span className="lh-skel-inline" aria-label="Loading available copies" />
                  ) : availableBooks !== null ? (
                    availableBooks.toLocaleString()
                  ) : (
                    "—"
                  )}
                </div>
                <div className="lh-stat-lbl">Available Now</div>
              </div>

              <div className="lh-stat-divider" aria-hidden="true" />

              <div>
                <div className="lh-stat-val">
                  {statsLoading ? (
                    <span className="lh-skel-inline" aria-label="Loading members count" />
                  ) : totalUsers !== null ? (
                    totalUsers.toLocaleString()
                  ) : (
                    "—"
                  )}
                </div>
                <div className="lh-stat-lbl">Registered Members</div>
              </div>

              <div className="lh-stat-divider" aria-hidden="true" />

              <div>
                <div className="lh-stat-val danger">
                  {statsLoading ? (
                    <span className="lh-skel-inline" aria-label="Loading overdue books count" />
                  ) : overdueBooks !== null ? (
                    overdueBooks.toLocaleString()
                  ) : (
                    "—"
                  )}
                </div>
                <div className="lh-stat-lbl">Overdue Books</div>
              </div>
            </div>

            {statsError && (
              <div className="lh-error-note" role="alert">
                <span>Live library statistics are temporarily unavailable.</span>
                <button type="button" className="lh-retry-btn" onClick={() => retryStats()}>
                  Retry
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
