import { NextResponse } from "next/server";
import { parseCredentials, withReadOnlyDatabase } from "@/lib/database";
import { getConnectionInfo } from "@/queries/connection";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const credentials = parseCredentials(body);
    const result = await withReadOnlyDatabase(credentials, getConnectionInfo);
    return NextResponse.json({ connected: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не вдалося підключитися до бази даних.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
