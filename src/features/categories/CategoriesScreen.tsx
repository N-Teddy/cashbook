import { useEffect, useState } from "react";
import { ArrowLeft, Edit, Plus, Tag, Trash2 } from "lucide-react";
import {
  categoryCreate,
  categoryDelete,
  categoryList,
  categoryUpdate,
  type Category,
} from "../../lib/categories";
import { Modal } from "../../components/Modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/Select";

export function CategoriesScreen(props: { onBack?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Category | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const list = await categoryList();
      setCategories(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onAdd() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a category name.");
      return;
    }

    setSaving(true);
    try {
      await categoryCreate({ name: trimmed, kind });
      setName("");
      setKind("expense");
      setShowAdd(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onEdit() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a category name.");
      return;
    }
    if (!editingCategory) return;

    setSaving(true);
    try {
      await categoryUpdate({ id: editingCategory.id, name: trimmed });
      setName("");
      setEditingCategory(null);
      setShowEdit(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(category: Category) {
    setError(null);
    try {
      await categoryDelete(category.id);
      setShowDeleteConfirm(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function openEdit(category: Category) {
    setEditingCategory(category);
    setName(category.name);
    setShowEdit(true);
  }

  const incomeCategories = categories.filter((c) => c.kind === "income");
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {props.onBack && (
            <button
              type="button"
              onClick={props.onBack}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          )}
          <h1 className="text-lg font-semibold tracking-tight">Categories</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* Expense Categories */}
          <div>
            <div className="mb-2 text-sm font-medium text-zinc-700">Expense Categories</div>
            {expenseCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                No expense categories yet.
              </div>
            ) : (
              <div className="space-y-2">
                {expenseCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-2xl bg-zinc-100 text-zinc-500">
                        <Tag className="size-5" />
                      </div>
                      <div className="text-sm font-medium">{category.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(category)}
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs font-medium"
                        title="Edit"
                      >
                        <Edit className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(category)}
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs font-medium"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Income Categories */}
          <div>
            <div className="mb-2 text-sm font-medium text-zinc-700">Income Categories</div>
            {incomeCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                No income categories yet.
              </div>
            ) : (
              <div className="space-y-2">
                {incomeCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-2xl bg-zinc-100 text-zinc-500">
                        <Tag className="size-5" />
                      </div>
                      <div className="text-sm font-medium">{category.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(category)}
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs font-medium"
                        title="Edit"
                      >
                        <Edit className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(category)}
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs font-medium"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      <Modal title="Add category" open={showAdd} onClose={() => setShowAdd(false)}>
        <div className="grid gap-3">
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. Food, Transport, Salary…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Type</div>
            <Select value={kind} onValueChange={(v) => setKind(v as "income" | "expense")}>
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={onAdd}
            className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save category"}
          </button>
        </div>
      </Modal>

      {/* Edit Category Modal */}
      <Modal title="Edit category" open={showEdit} onClose={() => setShowEdit(false)}>
        <div className="grid gap-3">
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. Food, Transport, Salary…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={onEdit}
            className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete category"
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
      >
        {showDeleteConfirm ? (
          <div className="grid gap-3">
            <div className="text-sm text-zinc-600">
              Are you sure you want to delete "{showDeleteConfirm.name}"? This action cannot be undone.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onDelete(showDeleteConfirm)}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
