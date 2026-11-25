import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getActiveSessionStatus } from "@/services/auth.service";

export async function GET() {
  const session = await getServerSession();
  const supabase = getSupabaseSecretKey() ? createSupabaseServerClient(true) : null;
  const status = await getActiveSessionStatus(session, supabase);
  return NextResponse.json(status);
}
