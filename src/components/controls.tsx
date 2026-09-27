import { cx } from "@/lib/format";
import type { ReactNode } from "react";

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "rounded-full px-3.5 py-2 text-sm font-medium",
        selected ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line",
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-semibold">{label}</legend>
      {hint ? <p className="text-sm leading-5 text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-line"
    >
      <span>
        <span className="block font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm leading-5 text-muted">{hint}</span> : null}
      </span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-sage" : "bg-[#ddd4c8]")}>
        <span
          className={cx(
            "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-base font-semibold">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-2xl bg-white px-4 py-3 text-base leading-6 ring-1 ring-line outline-none placeholder:text-[#a3988c] focus:ring-2 focus:ring-sage"
      />
    </label>
  );
}
