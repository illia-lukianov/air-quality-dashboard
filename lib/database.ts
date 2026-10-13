import { Client, type ClientConfig } from "pg";
import { READ_ONLY_TRANSACTION_QUERY } from "@/queries/connection";

export type DatabaseCredentials = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  sslMode: string;
  enableChannelBinding: boolean;
};

export function parseCredentials(value: unknown): DatabaseCredentials {
  if (!value || typeof value !== "object") {
    throw new Error("Введіть логін і пароль користувача PostgreSQL.");
  }

  const input = value as Record<string, unknown>;
  const username =
    process.env.PGUSER?.trim() ||
    (typeof input.username === "string" ? input.username.trim() : "");
  const password =
    process.env.PGPASSWORD ||
    (typeof input.password === "string" ? input.password : "");
  const host = process.env.PGHOST?.trim() || process.env.DB_HOST?.trim();
  const database = process.env.PGDATABASE?.trim() || process.env.DB_NAME?.trim();
  const portValue = Number(process.env.PGPORT ?? process.env.DB_PORT ?? "5432");

  if (!username || !password) {
    throw new Error("Налаштуйте PGUSER і PGPASSWORD або введіть логін та пароль.");
  }
  if (!host || !database) {
    throw new Error("Налаштуйте PGHOST і PGDATABASE (або DB_HOST і DB_NAME) у файлі .env.");
  }
  if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
    throw new Error("Налаштуйте коректний PGPORT у файлі .env.");
  }

  const sslMode = (process.env.PGSSLMODE ?? (process.env.DB_SSL?.toLowerCase() === "true" ? "verify-full" : "disable"))
    .trim()
    .toLowerCase();
  const supportedSslModes = ["disable", "require", "verify-ca", "verify-full"];
  if (!supportedSslModes.includes(sslMode)) {
    throw new Error("PGSSLMODE має бути disable, require, verify-ca або verify-full.");
  }
  const channelBinding = (process.env.PGCHANNELBINDING ?? "prefer").trim().toLowerCase();
  if (!["disable", "prefer", "require"].includes(channelBinding)) {
    throw new Error("PGCHANNELBINDING має бути disable, prefer або require.");
  }

  return {
    host,
    port: portValue,
    database,
    username,
    password,
    ssl: sslMode !== "disable",
    sslMode,
    enableChannelBinding: channelBinding !== "disable",
  };
}

export async function withReadOnlyDatabase<T>(
  credentials: DatabaseCredentials,
  operation: (client: Client) => Promise<T>,
): Promise<T> {
  const config: ClientConfig = {
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.username,
    password: credentials.password,
    ssl: credentials.ssl
      ? { rejectUnauthorized: credentials.sslMode !== "require" }
      : false,
    enableChannelBinding: credentials.enableChannelBinding,
    connectionTimeoutMillis: 8000,
    query_timeout: 15000,
    application_name: "airscope-dashboard",
  };
  const client = new Client(config);
  let connected = false;

  try {
    await client.connect();
    connected = true;
    await client.query(READ_ONLY_TRANSACTION_QUERY);
    return await operation(client);
  } finally {
    if (connected) await client.end();
  }
}
