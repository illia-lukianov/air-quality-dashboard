import { NextResponse } from "next/server";
import { parseCredentials, withReadOnlyDatabase } from "@/lib/database";
import {
  runReport,
  type ReportId,
  type ReportRequest,
} from "@/queries/reports";

export const runtime = "nodejs";

const reportIds = new Set<string>([
  "stations",
  "station-map",
  "station-measurements",
  "regional-pm",
  "harmful-pm",
  "optimal-so2",
  "optimal-co",
]);

function isReportId(value: unknown): value is ReportId {
  return typeof value === "string" && reportIds.has(value);
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      throw new Error("Некоректний запит.");
    }
    const input = body as Record<string, unknown>;
    const credentials = parseCredentials(input.credentials);
    if (!isReportId(input.report)) {
      throw new Error("Невідомий тип звіту.");
    }
    const reportInput: ReportRequest = {
      report: input.report,
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
