# Public Library Management System (LMS) - Core Application

This repository contains the core web application for our capstone project: Preventing Data Breaches and Record Inaccuracies in Public Libraries Through a Cybersecurity-Enhanced Management System.

This focuses strictly on the system architecture, application features, backend logic, and frontend interface.

## System Overview & Purpose:
Many of the local public libraries still rely on manual logbooks or outdated, unmaintained systems. This leads to misplaced book tracking, data entry errors, and open vulnerabilities where user information can be leaked or modified.

Our system bridges this gap by creating a secure, automated web application. It handles everyday library tasks like cataloging books and checking availability while embedding security checks directly into the code. The goal is to move the manual library in Iloilo away from vulnerable paper processes into a secure, digital workflow.

## Key System Features:

We structured the application around the CIA Triad to balance smooth library operations with strong defense mechanisms:

### User Access & Defense (Confidentiality)
*Role-Based Dashboards: Custom views and permissions depending on who logs in (Admin, Librarian, or Borrower).

*Bot Protection: Built-in CAPTCHA validation on the login form to stop automated brute-force attacks.

*Two-Factor Checks: Multi-Factor Authentication (MFA) via a email One-Time Password (OTP) for high-level staff actions.

*Session Control: Active session tracking that automatically logs users out after inactivity to prevent unauthorized physical terminal access.

## Operational Automation (Integrity)

*Input Sanitation: Every text field runs through validation rules to block malicious SQL Injection payloads.
	
*Real-Time Status Tracking: Dynamic status updates for books (Available, Borrowed, Lost, or Damaged).

*Policy Automation: The backend automatically calculates due dates, tracks overdue penalties, and blocks non-circulating, government-purchased books from leaving the library without staff intervention.

## Logging & Visibility (Availability):

*Live Audit Trail: A read-only logger that captures every major system event when a status changed) to ensure internal accountability.

## Language & Tech Stack:

*Tool Use: Visual Studio Code

*Application Framework: Next.js (App Router, TypeScript) with React & Tailwind CSS (migrated from legacy Flask in `legacy-flask/`).

*Database & Storage: Supabase (PostgreSQL + Supabase Storage).

*Libraries used: Zod validation, `bcryptjs` password hashing, Fernet PII encryption, HMAC-signed HTTP-only sessions, and Supabase SDK.


## How to Set Up and Run the Application:

### Prerequisites:
* Node.js (v20 or higher) and `npm`
* A configured Supabase project (run SQL migrations in `supabase/migrations/` in the Supabase SQL Editor)

### Installation Steps:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env.local` (or `.env`) and set your Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SECRET_KEY`).

3. **Run the Next.js development server:**
   ```bash
   npm run dev
   ```

4. **Interact with the System:**
   Open `http://localhost:3000` in your browser.

