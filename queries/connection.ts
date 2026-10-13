import type { Client } from "pg";

export const READ_ONLY_TRANSACTION_QUERY = "BEGIN READ ONLY";

export async function getConnectionInfo(client: Client) {
  const result = await client.query<{ database: string; username: string }>(
    "SELECT current_database() AS database, current_user AS username",
  );
  return result.rows[0];
}
