import { NextResponse } from "next/server";
import { parseCredentials, withReadOnlyDatabase } from "@/lib/database";
import { runReport, type ReportRequest } from "@/queries/reports";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      throw new Error("Некоректний запит.");
    }
    const input = body as Record<string, unknown>;
    const credentials = parseCredentials(input.credentials);
    const report = typeof input.report === "string" ? input.report : "";
    const reportInput: ReportRequest = {
      report,
      stationId: typeof input.stationId === "string" ? input.stationId : undefined,
      startDate: typeof input.startDate === "string" ? input.startDate : undefined,
      endDate: typeof input.endDate === "string" ? input.endDate : undefined,
      calculationType: typeof input.calculationType === "string" ? input.calculationType : undefined,
    };
    const rows = await withReadOnlyDatabase(credentials, (client) => runReport(client, reportInput));
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не вдалося сформувати звіт.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
