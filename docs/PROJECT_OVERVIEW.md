# Project Overview: Iloilo City Public Library Digital Modernization
**Prepared for:** Iloilo City Public Library Stakeholders, Management & Staff  
**Facility:** Iloilo City Public Library — *Dr. Graciano Lopez Jaena Learning Resource Center & Museum*  
**Date:** November 2026  
**Project Status:** Core Migration Complete — Ready for Review & Hosting Handover  

---

## 1. Overview (In Plain Language)

We are upgrading the **Iloilo City Public Library Management System** from its original local desktop-server prototype (**Python Flask + XAMPP MySQL + Bootstrap HTML**) into a **single, modern, cloud-ready web platform (Next.js + Supabase)**.

Think of this upgrade like **moving from a single back-office computer running local filing software into a modern, fireproof, cloud-connected city library portal**:
- **Citizens and students** can search available books from their phones, apply for library membership online, request book renewals, and view library events without waiting in line.
- **Librarians** can track every single physical copy of a book (including which exact copy is damaged or lost) and manage borrowing and returns accurately.
- **Library Management & IT** get stronger protection for citizen data, automatic nightly cloud backups, and a full audit log — without needing to maintain a local XAMPP server.

---

## 2. Why Are We Doing a Full Migration Instead of Patching the Old System?

The original system (`Public_Library_System`) was a great starting capstone prototype, but inspecting it showed **six structural limits** that make it difficult to run reliably as a permanent public service for Iloilo City:

| Area | Old System (`Public_Library_System`) | New Unified Platform | Why This Matters for the Library |
| :--- | :--- | :--- | :--- |
| **Hosting & Reliability** | Built around a **local XAMPP MySQL server** (`127.0.0.1:5000`) with local file folders (`valid_id_vault/`, `static/uploads/`) and manual SSL certificates (`cert.pem`). If that one PC shuts down, the library system goes offline. | Runs on **modern cloud web hosting + Supabase PostgreSQL** with automatic HTTPS and 24/7 availability. | No single office computer can take the library offline; accessible from anywhere in Iloilo City. |
| **Speed & Public Scale** | Local MySQL setup with older full-page reloads (Bootstrap HTML) and background Python threads that don't scale well on modern web hosting. | Instant, app-like web interface backed by a cloud database indexed for **1,000,000+ books** and **tens of thousands of citizens**. | Fast, smooth browsing even during peak school exam seasons and city-wide growth. |
| **Smart Privacy & Searchability (RA 10173)** | Encrypted almost every field — including public book titles and categories — with local keys, which caused unreadable text (`gAAAAAB...`) and prevented normal keyword search and category filtering. | **Selective bank-grade security**: passwords, PINs, OTPs, and uploaded IDs remain strictly hashed/encrypted, while public book catalogs stay readable and instantly searchable, protected by database-level access rules (RLS) and AES-256 disk encryption. | Protects citizens' private information while keeping book search fast, clean, and reliable. |
| **Book & Damaged-Copy Accountability** | Only counted total copies of a title (`volumes`, `available_copies`, `damaged_copies`). If the library had 50 copies of a book and 3 were damaged, staff could not tell *which* physical book was damaged. | Every physical copy now gets its own **Accession ID** (e.g., `ICPL-0069-C01`) and **Condition Status** (*Good, Fair, Damaged, Lost, Under Repair*), sortable and filterable on its own. | Stronger accountability for public library property and faster repair/replacement audits. |
| **Backups & Disaster Recovery** | Relied on an in-app Python timer (`APScheduler`) saving encrypted zip files locally alongside Dropbox. If the server was off, backups were missed. | **Automated cloud schedule** (every night at 2:00 AM) saving compressed snapshots directly from Supabase to Dropbox, plus one-click manual backups in System Settings. | Library records are automatically protected against power outages, floods, or computer failure. |
| **Long-Term Maintenance** | Required maintaining **two separate technologies together** (Python + Flask + C compilers + Node.js + XAMPP MySQL). | **One unified, modern TypeScript/Next.js codebase** with clear layers and strict input validation on every form and action. | Easier, faster, and less expensive for IT staff to maintain and expand in the future. |

---

## 3. What Is Changing for Every User?

### For Patrons, Students & Researchers (Public & Members)
- **Modern Online Book Search (`/browse`)**: Instant search by title, author, subject, or ISBN, with a clean *Collections* dropdown and an *Available Now* toggle so visitors know if a book is on the shelf before traveling to the library.
- **Streamlined Online Registration**: A compact 3-step digital membership form with Valid ID upload for library staff verification.
- **Mobile-Friendly Design & QR Login**: Works smoothly on smartphones, tablets, and library kiosks — including quick **QR Code sign-in**, **Dark/Light mode**, and self-service **Password & PIN reset via email**.
- **Personal Member Portal**: Registered patrons can save **Favorite books**, view currently **Borrowed Books & due dates**, submit **Renewal Requests online**, view past **Borrowing History**, and read official **Library Announcements**.

### For Librarians & Front-Desk Staff
- **Dedicated Librarian Workspace**: All **11 daily tools** ported and unified (Dashboard, Book Catalog, Inventory & Conditions, Library Cards, Returns, Patron Lookup, Renewal Requests, Events, Announcements, and Settings).
- **Clear Role Permissions**: Librarians manage daily circulation, books, and card renewals, while sensitive system-wide controls (deleting accounts, emergency lockdown, managing staff roles) remain strictly limited to Administrators.
- **Individual Copy Condition Tracking**: Staff can filter inventory by *Has Damaged Copies* or *Available Copies* and click **Inspect** to see exact damaged Accession IDs and condition notes.

### For Library Management & IT Administrators
- **Live Overview Dashboard**: Real-time statistics on cataloged books, active borrowing, registered patrons, pending applications, and system health.
- **Complete Audit & Error Logs**: Every major action (approvals, edits, deletions, logins, and system errors) is automatically recorded for full transparency and accountability.
- **Maintenance & Emergency Lockdown Controls**: Administrators can activate scheduled maintenance mode or emergency lockdown with a confirmation safeguard whenever needed.

---

## 4. Current Project Progress

All **7 Development & Migration Phases** are complete and verified:

1. **Phase 1 — Security Cleanup & Baseline**: Removed temporary files and established clean version control.
2. **Phase 2 & 3 — System Modernization**: Archived the legacy Flask prototype and rebuilt the application on a clean, secure, layered architecture.
3. **Phase 4 — Librarian Module**: Completed all 11 Librarian pages with role-based permissions.
4. **Phase 5 — Core Public Services**: Completed Email Password/PIN Reset, QR Login, Cloud Book Cover Storage, Automated Nightly Backups, and Member Settings.
5. **Phase 6 — Standalone Cutover**: Removed all dependence on the old Flask/XAMPP server so the new portal runs independently.
6. **Phase 7 — Schema Upgrade & 100% Feature Parity**: Added individual copy/condition tracking (`book_copies`), high-scale search indexes for 1M+ records, UI upgrades, and all remaining Member, MFA/CAPTCHA, and Staff APIs.

---

## 5. Final Steps Before Official Launch

To officially launch the upgraded system, only **three straightforward handover steps** remain:
1. **Apply the Final Database Update**: Run the prepared upgrade script (`004_schema_normalization.sql`) in the Supabase SQL Editor to activate copy-level tracking and high-scale search indexes.
2. **Connect Official Library Credentials**: Enter the official email sender, cloud backup folder, and security keys in the hosting settings.
3. **Staff Walkthrough & Go-Live**: Conduct a brief orientation with the library staff and IT team, then open the portal to the public.

---

*Prepared by the Iloilo City Public Library Modernization Team — Dr. Graciano Lopez Jaena Learning Resource Center & Museum.*
