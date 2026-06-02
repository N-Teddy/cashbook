import { invoke } from "@tauri-apps/api/core";

export async function getDbLocation(): Promise<string> {
  return invoke<string>("db_location");
}

