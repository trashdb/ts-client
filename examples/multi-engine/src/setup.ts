import { config } from "dotenv";
import { TrashDB } from "@trashdb/ts";

config();

export const db = new TrashDB({
  apiKey: process.env.TRASHDB_API_KEY!,
  ...(process.env.TRASHDB_BASE_URL ? { baseUrl: process.env.TRASHDB_BASE_URL } : {}),
});

export function when(minutes: number) {
  return { ttlMinutes: minutes, name: `multi-engine-${Date.now()}` };
}
