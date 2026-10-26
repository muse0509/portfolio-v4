import { drizzle } from "drizzle-orm/d1";

export function createDatabase(binding: ApiEnv["DB"]) {
  return drizzle(binding);
}
