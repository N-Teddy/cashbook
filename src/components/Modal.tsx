import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={props.onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-screen-sm px-3 pb-3">
        <div className="rounded-3xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <div className="text-sm font-semibold tracking-tight">
              {props.title}
            </div>
            <button
              type="button"
              onClick={props.onClose}
              className="grid size-9 place-items-center rounded-xl border border-zinc-200 bg-white"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="px-4 py-4">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

