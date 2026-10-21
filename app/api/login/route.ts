import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const expected = process.env.GGLADMIN_PASSWORD;
    if (!expected) return NextResponse.json({ error: "Admin password is not configured on the server." }, { status: 503 });
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length === 0 || password !== expected) {
      return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
    }
    await createAdminSession();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Login is not configured correctly. Check server environment variables." }, { status: 500 });
  }
}
