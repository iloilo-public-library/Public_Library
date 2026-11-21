import { logger } from "@/lib/logger";

const RESEND_URL = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = process.env.RESEND_FROM?.trim() || "onboarding@resend.dev";

  if (!apiKey) {
    logger.info("Email skipped (dev mode: RESEND_API_KEY not configured)", {
      to,
      subject,
    });
    return true;
  }

  try {
    const payload: Record<string, unknown> = {
      from,
      to: [to],
      subject,
      html,
    };
    if (text) payload.text = text;

    const resp = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      logger.info("Email delivered via Resend", { to, subject });
      return true;
    }

    const errText = await resp.text().catch(() => "");
    logger.error("Resend API returned error", {
      to,
      subject,
      status: resp.status,
      body: errText.slice(0, 300),
    });
    return false;
  } catch (err) {
    logger.error("Email delivery failed", {
      to,
      subject,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function wrapEmailLayout(headerSubtitle: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.08);overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(140deg,#0f2d5e 0%,#1a4fae 60%,#2563eb 100%);padding:32px 36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Iloilo City Public Library</h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;">${headerSubtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;color:#1f2937;font-size:15px;line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;text-align:center;">
            This is an automated security email from Iloilo City Public Library. Do not reply directly.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<boolean> {
  const html = wrapEmailLayout(
    "Password Reset Request",
    `<p style="margin:0 0 14px;">We received a request to reset the password for your Iloilo City Public Library account.</p>
     <p style="margin:0 0 22px;">Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.</p>
     <p style="text-align:center;margin:0 0 22px;">
       <a href="${resetUrl}" style="display:inline-block;background:#1a4fae;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 26px;border-radius:10px;">Reset Password</a>
     </p>
     <p style="margin:0;font-size:13px;color:#64748b;">If you did not request a password reset, you can safely ignore this email.</p>`
  );
  return sendEmail({
    to: toEmail,
    subject: "Reset your Iloilo City Public Library password",
    html,
    text: `Reset your password (valid for 30 minutes): ${resetUrl}`,
  });
}

export async function sendPinResetEmail(toEmail: string, resetUrl: string): Promise<boolean> {
  const html = wrapEmailLayout(
    "Security PIN Reset",
    `<p style="margin:0 0 14px;">We received a request to reset the 6-digit security PIN for your Iloilo City Public Library account.</p>
     <p style="margin:0 0 22px;">Click the button below to set a new 6-digit PIN. This link expires in <strong>30 minutes</strong>.</p>
     <p style="text-align:center;margin:0 0 22px;">
       <a href="${resetUrl}" style="display:inline-block;background:#1a4fae;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 26px;border-radius:10px;">Reset Security PIN</a>
     </p>
     <p style="margin:0;font-size:13px;color:#64748b;">If you did not request a PIN reset, please ignore this email and review your account security.</p>`
  );
  return sendEmail({
    to: toEmail,
    subject: "Reset your Iloilo City Public Library security PIN",
    html,
    text: `Reset your 6-digit security PIN (valid for 30 minutes): ${resetUrl}`,
  });
}

export async function sendOtpEmail(toEmail: string, otp: string): Promise<boolean> {
  const html = wrapEmailLayout(
    "Secure Login Verification",
    `<p style="margin:0 0 14px;">Use the verification code below to complete your sign-in to Iloilo City Public Library:</p>
     <div style="text-align:center;margin:20px 0;">
       <span style="display:inline-block;font-family:monospace;font-size:28px;font-weight:700;letter-spacing:6px;background:#f1f5f9;color:#0f2d5e;padding:14px 28px;border-radius:12px;border:1px solid #cbd5e1;">${otp}</span>
     </div>
     <p style="margin:0;font-size:13px;color:#64748b;">This one-time code expires shortly. Never share it with anyone.</p>`
  );
  return sendEmail({
    to: toEmail,
    subject: "Your Iloilo City Public Library verification code",
    html,
    text: `Your Iloilo City Public Library verification code is: ${otp}`,
  });
}
