import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { emailBlindIndex, getServerSession } from "@/lib/auth/session";
import { maybeEncryptPii } from "@/lib/crypto/fernet";

const PW_ALLOWED_RE = /^[A-Za-z\d@$!%*?&_#^]{8,64}$/;
const PW_COMPLEXITY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^]).{8,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VALID_GENDERS = new Set(["Male", "Female", "Others"]);

interface SignupPayload {
  firstname?: string;
  lastname?: string;
  age?: string | number;
  gender?: string;
  phone?: string;
  school?: string;
  city?: string;
  province?: string;
  education_level?: string;
  occupation?: string;
  is_government?: boolean | string | number;
  office_phone?: string;
  valid_id_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  role?: "user" | "librarian" | "admin";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupPayload;

    const firstname = (body.firstname ?? "").trim();
    const lastname = (body.lastname ?? "").trim();
    const age = body.age !== undefined && body.age !== null ? String(body.age).trim() : "";
    const gender = (body.gender ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const school = (body.school ?? "").trim();
    const city = (body.city ?? "").trim();
    const province = (body.province ?? "").trim();
    const educationLevel = (body.education_level ?? "").trim();
    const occupation = (body.occupation ?? "").trim();
    const isGovernment =
      body.is_government === true || body.is_government === "1" || body.is_government === 1;
    const officePhone = (body.office_phone ?? "").trim();
    const validIdName = (body.valid_id_name ?? "").trim().slice(0, 480);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const confirmPassword = body.confirm_password;
    const requestedRole =
      body.role === "admin" || body.role === "librarian" ? body.role : "user";

    const isStaffCreation = requestedRole === "admin" || requestedRole === "librarian";

    if (isStaffCreation) {
      const session = await getServerSession();
      if (!session || session.role !== "admin") {
        return NextResponse.json(
          { ok: false, error: "Unauthorized: Only admins can create staff accounts." },
          { status: 401 }
        );
      }
    }

    if (firstname.length < 2 || lastname.length < 2) {
      return NextResponse.json(
        { ok: false, error: "First name and last name must each be at least 2 characters." },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!isStaffCreation) {
      if (!VALID_GENDERS.has(gender)) {
        return NextResponse.json(
          { ok: false, error: "Please select a gender (Male, Female, or Others)." },
          { status: 400 }
        );
      }
      if (!age || Number(age) < 7 || Number(age) > 120 || Number.isNaN(Number(age))) {
        return NextResponse.json(
          { ok: false, error: "Please enter a valid age between 7 and 120." },
          { status: 400 }
        );
      }
      if (!phone || phone.replace(/\D/g, "").length < 7) {
        return NextResponse.json(
          { ok: false, error: "Please enter a valid phone number." },
          { status: 400 }
        );
      }
    }

    if (!PW_ALLOWED_RE.test(password) || !PW_COMPLEXITY_RE.test(password)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Password must be 8-64 characters and contain uppercase, lowercase, a number, and a special character (@$!%*?&_#^).",
        },
        { status: 400 }
      );
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json(
        { ok: false, error: "Password and Confirm Password do not match." },
        { status: 400 }
      );
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SUPABASE_SECRET_KEY is missing in this runtime. Locally: restart `npm run dev` after saving .env.local. On Vercel: add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Project Settings -> Environment Variables and Redeploy.",
        },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    // Keep username and profile fields in plaintext; only hash/encrypt credentials & sensitive ID path
    const usernameKey = email;

    const lookupKeys = Array.from(
      new Set([email, emailBlindIndex(email)].filter((k): k is string => Boolean(k)))
    );
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .or(
        `username.in.(${lookupKeys.map((k) => `"${k.replace(/"/g, "")}"`).join(",")}),email_display.eq."${email.replace(/"/g, "")}"`
      )
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        username: usernameKey,
        email_display: email,
        firstname,
        lastname,
        password: hashedPassword,
        role: requestedRole,
        age: age || null,
        gender: gender || null,
        phone_number: phone || null,
        school: school || null,
        city: city || null,
        province: province || null,
        education_level: educationLevel || null,
        occupation: occupation || null,
        is_government: isGovernment,
        office_phone: isGovernment && officePhone ? officePhone : null,
        valid_id_path: validIdName ? maybeEncryptPii(validIdName) : null,
        is_active: true,
        is_approved: isStaffCreation,
        status: "offline",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { ok: false, error: insertError?.message || "Failed to create account." },
        { status: 500 }
      );
    }

    if (!isStaffCreation) {
      await supabase.from("account_requests").insert({
        user_id: inserted.id,
        username: usernameKey,
        request_type: "register",
        reason: "New user registration awaiting admin approval.",
        status: "pending",
      });
    }

    return NextResponse.json(
      {
        ok: true,
        id: inserted.id,
        role: requestedRole,
        message: isStaffCreation
          ? `${requestedRole.charAt(0).toUpperCase() + requestedRole.slice(1)} account created and activated.`
          : "Registration submitted! Your account is now awaiting administrator approval.",
      },
      { status: isStaffCreation ? 201 : 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
