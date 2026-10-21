import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const streams = [
  { key: "performers", table: "performer_applications" },
  { key: "sponsors", table: "sponsor_applications" },
  { key: "guests", table: "guest_applications" },
  { key: "team", table: "team_applications" },
] as const;

const safeFields = [
  "id", "app_id", "full_name", "name", "stage_name", "business_name",
  "contact_person", "mobile_number", "whatsapp_number", "whatsapp", "phone",
  "email", "city", "application_status", "status", "payment_status", "created_at",
];

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown database error";
  // Return a concise diagnostic without exposing connection strings or credentials.
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database connection hidden]").slice(0, 220);
}

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured on this deployment." },
      { status: 503 },
    );
  }

  try {
    const sql = neon(databaseUrl);
    const counts: Record<string, number | null> = {};
    const recent: Record<string, Record<string, unknown>[]> = {};
    const diagnostics: Record<string, string> = {};

    await Promise.all(streams.map(async (stream) => {
      try {
        const rows = await sql.query(`SELECT COUNT(*)::int AS total FROM public.${stream.table}`);
        counts[stream.key] = Number(rows?.[0]?.total ?? 0);
      } catch (error) {
        counts[stream.key] = null;
        diagnostics[`${stream.key}Count`] = safeError(error);
      }

      try {
        const rows = await sql.query(`SELECT * FROM public.${stream.table} ORDER BY created_at DESC LIMIT 8`);
        recent[stream.key] = (rows || []).map((row: Record<string, unknown>) =>
          Object.fromEntries(safeFields.filter((field) => field in row).map((field) => [field, row[field]])),
        );
      } catch (error) {
        recent[stream.key] = [];
        diagnostics[`${stream.key}Records`] = safeError(error);
      }
    }));

    try {
      const rows = await sql.query(
        "SELECT COUNT(*)::int AS total FROM public.ggl_talent_trip_registrations",
      );
      counts.talentTrip = Number(rows?.[0]?.total ?? 0);
    } catch (error) {
      counts.talentTrip = null;
      diagnostics.talentTrip = safeError(error);
    }

    return NextResponse.json({
      success: true,
      counts,
      recent,
      diagnostics,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to connect to the GGL database.", diagnostic: safeError(error) },
      { status: 503 },
    );
  }
}
