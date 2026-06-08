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

export async function categoryCreate(input: {
  name: string;
  kind: "income" | "expense";
  parentId?: string | null;
}) {
  return invoke<Category>("category_create", { input });
}

export async function categoryUpdate(input: {
  id: string;
  name: string;
}) {
  return invoke<void>("category_update", { input });
}

export async function categoryDelete(id: string) {
  return invoke<void>("category_delete", { id });
}
