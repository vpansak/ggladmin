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
  "mobile_number", "whatsapp_number", "whatsapp", "phone", "email", "city",
  "application_status", "status", "payment_status", "created_at"
];

export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return NextResponse.json({ error: "DATABASE_URL is not configured on this deployment." }, { status: 503 });

  try {
    const sql = neon(databaseUrl);
    const counts: Record<string, number> = {};
    const recent: Record<string, Record<string, unknown>[]> = {};
    await Promise.all(streams.map(async (stream) => {
      try {
        const rows = await sql.query(`SELECT COUNT(*)::int AS total FROM ${stream.table}`);
        counts[stream.key] = Number(rows?.[0]?.total || 0);
      } catch { counts[stream.key] = 0; }
      try {
        const rows = await sql.query(`SELECT * FROM ${stream.table} ORDER BY created_at DESC LIMIT 8`);
        recent[stream.key] = (rows || []).map((row: Record<string, unknown>) =>
          Object.fromEntries(safeFields.filter((field) => field in row).map((field) => [field, row[field]]))
        );
      } catch { recent[stream.key] = []; }
    }));

    try {
      const rows = await sql.query("SELECT COUNT(*)::int AS total FROM ggl_talent_trip_registrations");
      counts.talentTrip = Number(rows?.[0]?.total || 0);
    } catch { counts.talentTrip = 0; }

    return NextResponse.json({ success: true, counts, recent, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Unable to connect to the GGL database. Verify DATABASE_URL." }, { status: 503 });
  }
}
