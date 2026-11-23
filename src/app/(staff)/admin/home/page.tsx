"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeftRight,
  Boxes,
  Gauge,
  Megaphone,
  UserCog,
  Users,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { swrPrivateConfig } from "@/lib/api";
import type { DashboardStats } from "@/types/library";
import { EagleHeroVisual } from "@/components/home/EagleHeroVisual";
import "@/components/home/admin-home.css";

export default function AdminHomePage() {
  const {
    data: stats,
    error: statsError,
    isLoading: statsLoading,
    mutate: retryStats,
  } = useSWR<DashboardStats>("/api/dashboard/stats", swrPrivateConfig);

  const totalBooks = typeof stats?.total_books === "number" ? stats.total_books : null;
  const availableBooks = typeof stats?.available_books === "number" ? stats.available_books : null;
  const totalUsers = typeof stats?.total_users === "number" ? stats.total_users : null;
  const pendingRequests =
    typeof stats?.pending_requests === "number" ? stats.pending_requests : null;

  return (
    <StaffShell title="Admin Home" role="admin">
      <div className="admin-home-page">
        <section className="ah-hero" aria-label="Admin home overview">
          <div className="ah-hero-inner">
            {/* TOP ROW */}
            <div className="ah-top-row">
              {/* Left: brand + headline + CTAs */}
              <div className="ah-left">
                <div className="ah-badge">
                  <span className="ah-badge-dot" aria-hidden="true" />
                  Dr. Graciano Lopez Jaena Learning Resource Center
                </div>

                <h1 className="ah-title">
                  Iloilo Public
                  <br />
                  <span>Library</span>
                </h1>

                <p className="ah-subtitle">
                  A community learning hub dedicated to accessible knowledge and lifelong learning
                  for all residents of Iloilo City.
                </p>

                <div className="ah-cta-row">
                  <Link href="/dashboard" className="ah-cta">
                    <Gauge className="h-4 w-4" aria-hidden="true" />
                    Go to Dashboard
                  </Link>
                  <Link href="/admin/announcements" className="ah-cta-ghost">
                    <Megaphone className="h-4 w-4" aria-hidden="true" />
                    Announcements
                  </Link>
                </div>
              </div>

              {/* Right: Holographic Eagle visual + Pending Requests alert card */}
              <EagleHeroVisual
                pendingRequests={pendingRequests}
                loadingPending={statsLoading}
                pendingError={Boolean(statsError)}
              />
            </div>

            {/* BOTTOM CARD GRID */}
            <nav className="ah-card-grid" aria-label="Quick management shortcuts">
              <Link href="/admin/librarians" className="ah-quick-card">
                <UserCog
                  className="ah-qc-icon h-5 w-5"
                  style={{ color: "#9fc1e1" }}
                  aria-hidden="true"
                />
                <div className="ah-qc-name">Librarians</div>
                <div className="ah-qc-sub">Manage &amp; track all books &amp; borrowers</div>
              </Link>

              <Link href="/admin/users" className="ah-quick-card">
                <Users
                  className="ah-qc-icon h-5 w-5"
                  style={{ color: "#48c78e" }}
                  aria-hidden="true"
                />
                <div className="ah-qc-name">Members</div>
                <div className="ah-qc-sub">
                  {statsLoading
                    ? "Loading…"
                    : totalUsers !== null
                      ? `${totalUsers.toLocaleString()} registered`
                      : "— registered"}
                </div>
              </Link>

              <Link href="/admin/library-cards" className="ah-quick-card">
                <ArrowLeftRight
                  className="ah-qc-icon h-5 w-5"
                  style={{ color: "#ffb74d" }}
                  aria-hidden="true"
                />
                <div className="ah-qc-name">Borrowing</div>
                <div className="ah-qc-sub">Checkouts &amp; returns</div>
              </Link>

              <Link href="/admin/books" className="ah-quick-card">
                <Boxes
                  className="ah-qc-icon h-5 w-5"
                  style={{ color: "#5ed3c8" }}
                  aria-hidden="true"
                />
                <div className="ah-qc-name">Manage Books &amp; Inventory</div>
                <div className="ah-qc-sub">
                  {statsLoading
                    ? "Loading…"
                    : availableBooks !== null
                      ? `${availableBooks.toLocaleString()} available`
                      : "— available"}
                </div>
              </Link>
            </nav>

            {/* STATS ROW */}
            <div className="ah-stats" aria-label="Library catalog summary">
              <div>
                <div className="ah-stat-val">
                  {statsLoading ? (
                    <span className="ah-skel-inline" aria-label="Loading books count" />
                  ) : totalBooks !== null ? (
                    totalBooks.toLocaleString()
                  ) : (
                    "—"
                  )}
                </div>
                <div className="ah-stat-lbl">Books in Catalog</div>
              </div>

              <div className="ah-stat-divider" aria-hidden="true" />

              <div>
                <div className="ah-stat-val">
                  {statsLoading ? (
                    <span className="ah-skel-inline" aria-label="Loading available copies" />
                  ) : availableBooks !== null ? (
                    availableBooks.toLocaleString()
                  ) : (
                    "—"
                  )}
                </div>
                <div className="ah-stat-lbl">Available Now</div>
              </div>

              <div className="ah-stat-divider" aria-hidden="true" />

              <div>
                <div className="ah-stat-val">
                  {statsLoading ? (
                    <span className="ah-skel-inline" aria-label="Loading members count" />
                  ) : totalUsers !== null ? (
                    totalUsers.toLocaleString()
                  ) : (
                    "—"
                  )}
                </div>
                <div className="ah-stat-lbl">Registered Members</div>
              </div>
            </div>

            {statsError && (
              <div className="ah-error-note" role="alert">
                <span>Live library statistics are temporarily unavailable.</span>
                <button type="button" className="ah-retry-btn" onClick={() => retryStats()}>
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
