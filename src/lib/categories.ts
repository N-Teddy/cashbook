import { invoke } from "@tauri-apps/api/core";

export type Category = {
  id: string;
  name: string;
  kind: "income" | "expense" | string;
  parentId: string | null;
};

export async function categoryList(kind?: "income" | "expense") {
  return invoke<Category[]>("category_list", { kind: kind ?? null });
}

