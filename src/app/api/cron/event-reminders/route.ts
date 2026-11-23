import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import {
  addDaysIso,
  expandEventsForRange,
  type EventExceptionRecord,
  type MasterEventRecord,
} from "@/lib/calendar/recurrence";
import { sendEmail } from "@/lib/email";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { logger } from "@/lib/logger";

const EMAIL_BATCH_SIZE = 20;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function getManilaNowDateStr(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function manilaEventStartMs(dateStr: string, startTime: string | null): number {
  const hhmm = startTime ? startTime.slice(0, 5) : "08:00";
  return Date.parse(`${dateStr}T${hhmm}:00+08:00`);
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron invocation." }, { status: 401 });
  }
  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  const nowMs = Date.now();
  const todayStr = getManilaNowDateStr();
  const horizonStr = addDaysIso(todayStr, 2);

  try {
    const [eventsRes, remindersRes, exceptionsRes] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, description, event_date, end_date, start_time, end_time, all_day, location, category, audience, recurrence_freq, recurrence_interval, recurrence_weekdays, recurrence_day_of_month, recurrence_until, recurrence_count"
        ),
      supabase.from("event_reminders").select("event_id, remind_before_minutes"),
      supabase.from("event_exceptions").select("*"),
    ]);

    if (eventsRes.error) {
      return NextResponse.json({ ok: false, error: eventsRes.error.message }, { status: 500 });
    }
    if (remindersRes.error) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        skipped: true,
        reason: "event_reminders table not yet migrated.",
      });
    }

    const remindersByEvent = new Map<number, number[]>();
    for (const r of remindersRes.data ?? []) {
      const eid = Number(r.event_id);
      const list = remindersByEvent.get(eid) ?? [];
      list.push(Number(r.remind_before_minutes));
      remindersByEvent.set(eid, list);
    }

    const masters = ((eventsRes.data ?? []) as unknown as MasterEventRecord[]).filter((m) =>
      remindersByEvent.has(m.id)
    );
    const exceptions = (exceptionsRes.data ?? []) as EventExceptionRecord[];
    const { occurrences } = expandEventsForRange(masters, exceptions, todayStr, horizonStr);

    let sentCount = 0;
    let failedCount = 0;
    const sendEmailsEnabled = process.env.EVENT_REMINDER_EMAILS_ENABLED === "true";

    for (const occ of occurrences) {
      const offsets = remindersByEvent.get(occ.master_id) ?? [];
      const startMs = manilaEventStartMs(occ.event_date, occ.all_day ? null : occ.start_time);

      for (const offsetMin of offsets) {
        const triggerMs = startMs - offsetMin * 60_000;
        if (nowMs < triggerMs || nowMs > startMs + 5 * 60_000) continue;

        const { error: logErr } = await supabase.from("event_reminder_log").insert({
          event_id: occ.master_id,
          occurrence_date: occ.occurrence_date,
          remind_before_minutes: offsetMin,
          recipient_count: 0,
        });

        if (logErr) {
          if (logErr.code === "23505") continue;
          logger.warn("Reminder log insert failed", { eventId: occ.master_id, offsetMin, code: logErr.code });
          failedCount++;
          continue;
        }

        const audience = occ.audience || "all";
        if (audience !== "staff") {
          const timeLabel = occ.all_day ? "All day" : (occ.start_time || "08:00").slice(0, 5);
          const body = `Reminder: "${occ.title}" starts on ${occ.event_date} (${timeLabel} PHT)${occ.location ? ` at ${occ.location}` : ""}.`;
          await supabase.from("announcements").insert({
            title: `Event Reminder: ${occ.title}`.slice(0, 120),
            body,
            category: "reminder",
            pinned: false,
            author: "Event Calendar",
            target_user_id: null,
          });
        }

        let emailRecipients = 0;
        if (sendEmailsEnabled && audience !== "staff") {
          const { data: users } = await supabase
            .from("users")
            .select("id, email")
            .eq("role", "user")
            .eq("is_active", true)
            .eq("is_approved", true)
            .limit(200);

          const emails = (users ?? [])
            .map((u) => safeDecryptPii(String(u.email || "")).trim())
            .filter((e) => e.includes("@"));

          for (let i = 0; i < emails.length; i += EMAIL_BATCH_SIZE) {
            const batch = emails.slice(i, i + EMAIL_BATCH_SIZE);
            await Promise.all(
              batch.map(async (to) => {
                const ok = await sendEmail({
                  to,
                  subject: `Reminder: ${occ.title}`,
                  html: `<p><strong>${occ.title}</strong> is scheduled on ${occ.event_date}${occ.location ? ` at ${occ.location}` : ""}.</p>`,
                  text: `Reminder: ${occ.title} on ${occ.event_date}${occ.location ? ` at ${occ.location}` : ""}.`,
                });
                if (ok) emailRecipients++;
              })
            );
          }
        }

        await supabase
          .from("event_reminder_log")
          .update({ recipient_count: emailRecipients })
          .eq("event_id", occ.master_id)
          .eq("occurrence_date", occ.occurrence_date)
          .eq("remind_before_minutes", offsetMin);

        sentCount++;
      }
    }

    if (sentCount > 0) {
      await recordAuditEvent(
        {
          action: "send_event_reminders",
          resource: "events",
          actorEmail: "cron@system",
          actorRole: "admin",
          route: "/api/cron/event-reminders",
          method: "GET",
          details: `sent=${sentCount} failed=${failedCount}`,
        },
        supabase
      );
    }

    return NextResponse.json({
      ok: true,
      checked_occurrences: occurrences.length,
      sent: sentCount,
      failed: failedCount,
    });
  } catch (err) {
    logger.error("Event reminders cron failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: "Event reminders job failed." }, { status: 500 });
  }
}
