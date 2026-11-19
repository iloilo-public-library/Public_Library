import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { emailBlindIndex } from "@/lib/auth/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({
      available: false,
      taken: false,
      reason: "Enter a valid email address.",
    });
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json({ available: true, taken: false, reason: "" });
  }

  try {
    const supabase = createSupabaseServerClient(true);
    const lookupKeys = [email];
    const blinded = emailBlindIndex(email);
    if (blinded) lookupKeys.unshift(blinded);

    const { data: existing, error } = await supabase
      .from("users")
      .select("id")
      .or(
        `username.in.(${lookupKeys.map((k) => `"${k.replace(/"/g, "")}"`).join(",")}),email_display.eq."${email.replace(/"/g, "")}"`
      )
      .limit(1);

    if (error) {
      return NextResponse.json({ available: true, taken: false, reason: "" });
    }

    const taken = (existing?.length ?? 0) > 0;
    return NextResponse.json({
      available: !taken,
      taken,
      reason: taken ? "This email is already registered." : "Email is available.",
    });
  } catch {
    return NextResponse.json({ available: true, taken: false, reason: "" });
  }
}
