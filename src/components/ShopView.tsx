"use client";

import { buyHint, cx, formatAmount, shoppingText, usesLabel } from "@/lib/format";
import { CATEGORY_LABEL, CATEGORY_ORDER, formatWeekRange } from "@/lib/prefs";
import type { ShoppingItem, WeekPlan } from "@/lib/types";
import { useMemo, useState } from "react";

export function ShopView({
  plan,
  checked,
  onToggle,
  onClear,
  onGenerate,
}: {
  plan: WeekPlan | null;
  checked: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onGenerate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const checkedSet = useMemo(() => new Set(checked), [checked]);

  if (!plan) {
    return (
      <section className="px-4 py-8">
        <h1 className="font-display text-3xl tracking-tight">Ostoslista</h1>
        <p className="mt-2 text-sm leading-5 text-muted">Lista syntyy viikon resepteistä. Luo ensin menu.</p>
        <button type="button" onClick={onGenerate} className="mt-5 rounded-2xl bg-sage px-4 py-3.5 font-semibold text-white">
          Luo viikkomenu
        </button>
      </section>
    );
  }

  const needle = query.trim().toLocaleLowerCase("fi");
  const visible = plan.shopping.filter((item) => {
    if (onlyOpen && checkedSet.has(item.id)) return false;
    if (!needle) return true;
    return item.name.toLocaleLowerCase("fi").includes(needle);
  });
  const done = plan.shopping.filter((item) => checkedSet.has(item.id)).length;

  async function copyList() {
    const text = shoppingText(formatWeekRange(plan!.weekOf), plan!.shopping, onlyOpen ? checkedSet : null);
    await navigator.clipboard.writeText(text);
    setNotice("Lista kopioitu");
    window.setTimeout(() => setNotice(null), 1800);
  }

  async function shareList() {
    const text = shoppingText(formatWeekRange(plan!.weekOf), plan!.shopping, checkedSet);
    if (!navigator.share) {
      await copyList();
      return;
    }
    try {
      await navigator.share({ title: formatWeekRange(plan!.weekOf), text });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyList();
    }
  }

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-line/80 bg-shell/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Ostoslista</h1>
            <p className="text-sm text-muted">
              {done}/{plan.shopping.length} haettu · {plan.prefs.householdSize === 2 ? "kahdelle" : "yhdelle"}
            </p>
          </div>
          <p className="text-sm font-medium text-sage">{notice}</p>
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Etsi tuotteita</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Etsi"
            className="w-full rounded-2xl bg-white px-4 py-3 text-base ring-1 ring-line outline-none focus:ring-2 focus:ring-sage"
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            aria-pressed={onlyOpen}
            onClick={() => setOnlyOpen((value) => !value)}
            className={cx("rounded-full px-3 py-1.5 text-sm font-medium", onlyOpen ? "bg-ink text-white" : "bg-white ring-1 ring-line")}
          >
            Vain puuttuvat
          </button>
          <button type="button" onClick={copyList} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-line">
            Kopioi
          </button>
          <button type="button" onClick={shareList} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-line">
            Jaa
          </button>
        </div>
      </header>

      <div className="px-4 py-2">
        <p className="py-2 text-xs leading-4 text-muted">
          Määrät ovat raaka- tai kuivapainoja. Arki on kerrottu viidellä. Osta lähin pakkaus.
        </p>
        {CATEGORY_ORDER.map((category) => {
          const items = visible.filter((item) => item.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} className="pt-3">
              <h2 className="text-sm font-semibold text-muted">{CATEGORY_LABEL[category]}</h2>
              <ul className="mt-1">
                {items.map((item) => (
                  <ShopRow key={item.id} item={item} checked={checkedSet.has(item.id)} onToggle={() => onToggle(item.id)} />
                ))}
              </ul>
            </section>
          );
        })}
        {visible.length === 0 ? <p className="py-8 text-sm text-muted">Ei osumia.</p> : null}
        {done > 0 ? (
          <button type="button" onClick={onClear} className="mt-4 mb-2 text-sm font-medium text-muted">
            Tyhjennä rastit
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ShopRow({ item, checked, onToggle }: { item: ShoppingItem; checked: boolean; onToggle: () => void }) {
  const hint = [item.detail, buyHint(item)].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className="flex w-full items-start gap-3 py-3 text-left"
      >
        <span
          className={cx(
            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
            checked ? "border-sage bg-sage text-white" : "border-[#cfc5b8] bg-white",
          )}
          aria-hidden="true"
        >
          {checked ? "✓" : ""}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx("block font-medium", checked && "text-muted line-through")}>{item.name}</span>
          <span className="mt-0.5 block text-xs leading-4 text-muted">{usesLabel(item.uses)}</span>
          {hint ? <span className="mt-0.5 block text-xs leading-4 text-muted">{hint}</span> : null}
        </span>
        <span className={cx("shrink-0 text-sm font-semibold tabular-nums", checked && "text-muted")}>{formatAmount(item)}</span>
      </button>
    </li>
  );
}
