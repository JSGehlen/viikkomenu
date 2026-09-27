"use client";

import { AuthView } from "@/components/AuthView";
import { GenerateView } from "@/components/GenerateView";
import { BagIcon, GearIcon, WeekIcon } from "@/components/icons";
import { SettingsView } from "@/components/SettingsView";
import { ShopView } from "@/components/ShopView";
import { batchLockDays, changedMainKeys, columnOf, mealsFor, type MainColumn } from "@/components/WeekOverview";
import { WeekView } from "@/components/WeekView";
import { accountSnapshot, loadAccount, saveAccount } from "@/lib/db";
import { saturdayMatches } from "@/lib/saturday";
import { cx } from "@/lib/format";
import { DAY_ORDER, addWeek, foodPrefsFromSettings, todayId } from "@/lib/prefs";
import { includesSlot } from "@/lib/span";
import { buildSamplePlan } from "@/lib/sample";
import { forgetBrowserKey } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import type { DayId, Meal, Persisted, Settings, WeekPlan } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Screen = "week" | "shop" | "settings" | "generate";

function lockedMeals(plan: WeekPlan, locks: Record<string, true>) {
  const kept = new Map<string, { day: DayId; slot: MainColumn; meal: Meal }>();
  for (const item of DAY_ORDER) {
    for (const meal of mealsFor(plan, item.id)) {
      const slot = columnOf(plan, item.id, meal);
      if (!slot || !locks[`${item.id}:${slot}`]) continue;
      for (const day of batchLockDays(plan, item.id, slot)) {
        const chosen = mealsFor(plan, day).find((candidate) => columnOf(plan, day, candidate) === slot);
        if (chosen) kept.set(`${day}:${slot}`, { day, slot, meal: chosen });
      }
    }
  }
  return [...kept.values()];
}

function mealTitles(plan: WeekPlan): string[] {
  return [
    ...(plan.weekdays ?? []).flatMap((day) =>
      day.meals.filter((meal) => meal.slot === "lounas" || meal.slot === "paivallinen").map((meal) => meal.title),
    ),
    ...(plan.weekday ?? []).filter((meal) => meal.slot === "lounas" || meal.slot === "paivallinen").map((meal) => meal.title),
    ...plan.saturdayMeals.map((meal) => meal.title),
    ...plan.sunday.filter((meal) => meal.slot === "paivallinen").map((meal) => meal.title),
  ];
}

export function App({ serverKey }: { serverKey: boolean }) {
  const [state, setState] = useState<Persisted | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("week");
  const [day, setDay] = useState<DayId>(() => todayId());
  const [generating, setGenerating] = useState(false);
  const [generateNext, setGenerateNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locks, setLocks] = useState<Record<string, true>>({});
  const [fresh, setFresh] = useState<Record<string, true>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const snapshot = useRef("");
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (caught) {
      setAccountError(caught instanceof Error ? caught.message : "Supabase-asetukset puuttuvat.");
      setBooted(true);
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      if (!session) {
        snapshot.current = "";
        setState(null);
        setBooted(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setAccountError(null);
    loadAccount()
      .then((next) => {
        if (cancelled) return;
        snapshot.current = accountSnapshot(next);
        setState(next);
        setBooted(true);
      })
      .catch((caught) => {
        if (cancelled) return;
        setAccountError(caught instanceof Error ? caught.message : "Tietoja ei saatu ladattua.");
        setBooted(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    forgetBrowserKey();
  }, []);

  useEffect(() => {
    if (!userId || !state || !booted) return;
    const next = accountSnapshot(state);
    if (next === snapshot.current) return;
    const pending = state;
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          await saveAccount(pending);
          snapshot.current = next;
        })
        .catch((caught) => {
          setBanner(caught instanceof Error ? caught.message : "Tallennus tietokantaan epäonnistui.");
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state, userId, booted]);

  const plan = state?.plans.find((item) => item.id === state.activeId) ?? state?.plans[0] ?? null;
  const openCount = plan ? plan.shopping.length - (state?.checks[plan.id]?.length ?? 0) : 0;

  function updateSettings(settings: Settings) {
    setState((current) => (current ? { ...current, settings } : current));
  }

  function showExample() {
    setState((current) => {
      if (!current) return current;
      const existing = current.plans.find((item) => item.sample);
      if (existing) return { ...current, activeId: existing.id };
      const sample = buildSamplePlan();
      return { ...current, plans: [sample, ...current.plans].slice(0, 8), activeId: sample.id };
    });
    setLocks({});
    setFresh({});
    setDay(todayId());
    setScreen("week");
  }

  function selectPlan(id: string) {
    setLocks({});
    setFresh({});
    setState((current) => (current ? { ...current, activeId: id } : current));
    setDay(todayId());
  }

  function toggleLock(day: DayId, slot: MainColumn) {
    if (!plan) return;
    const keys = batchLockDays(plan, day, slot).map((id) => `${id}:${slot}`);
    const unlock = keys.every((key) => locks[key]);
    setLocks((current) => {
      const next = { ...current };
      for (const key of keys) {
        if (unlock) delete next[key];
        else next[key] = true;
      }
      return next;
    });
  }

  function deletePlan(id: string) {
    setLocks({});
    setFresh({});
    setState((current) => {
      if (!current) return current;
      const plans = current.plans.filter((item) => item.id !== id);
      const checks = { ...current.checks };
      delete checks[id];
      return {
        ...current,
        plans,
        checks,
        activeId: current.activeId === id ? (plans[0]?.id ?? null) : current.activeId,
      };
    });
  }

  function toggleCheck(id: string) {
    if (!plan || !state) return;
    const current = state.checks[plan.id] ?? [];
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    setState({ ...state, checks: { ...state.checks, [plan.id]: next } });
  }

  async function generate(options?: { fill?: boolean; next?: boolean }) {
    if (!state) return;
    const fill = options?.fill === true;
    const next = options?.next === true;
    const prefs = foodPrefsFromSettings(state.settings);
    const previous = state.plans.find((item) => item.id === state.activeId);
    const locked = fill && previous ? lockedMeals(previous, locks) : [];
    if (fill && previous && !locked.some((item) => item.day === "sat")) {
      const saturdayMain = mealsFor(previous, "sat").find((meal) => meal.slot === "jousto" && !/puuro/i.test(meal.title));
      if (saturdayMain && saturdayMatches(saturdayMain.title, prefs.saturday)) {
        locked.push({ day: "sat", slot: "lounas", meal: saturdayMain });
      }
    }
    if (fill && locked.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: state.settings.model,
          prefs,
          previousTitles: prefs.avoidRepeat && previous ? mealTitles(previous) : [],
          locked,
          nextWeek: next,
          weekOf: next && previous ? addWeek(previous.weekOf) : undefined,
          previousSunday: next && previous ? previous.sunday : undefined,
          previousMains:
            next && previous
              ? (["mon", "tue", "wed", "thu", "fri"] as const).flatMap((id) =>
                  (["lounas", "paivallinen"] as const).flatMap((slot) => {
                    const meal = mealsFor(previous, id).find((item) => item.slot === slot);
                    return meal ? [{ day: id, slot, meal }] : [];
                  }),
                )
              : undefined,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const failure = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(failure?.error || "Viikon luonti epäonnistui.");
      }
      const data = (await response.json()) as { plan?: WeekPlan };
      if (!data.plan) throw new Error("Viikon luonti epäonnistui.");
      const created = data.plan;
      setFresh(fill && previous ? changedMainKeys(previous, created) : {});
      setState((current) =>
        current
          ? { ...current, plans: [created, ...current.plans].slice(0, 8), activeId: created.id }
          : current,
      );
      if (!fill) setLocks({});
      const first = (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).find((id) => includesSlot(id, "iltapala", prefs)) ?? "mon";
      setDay(first);
      setScreen("week");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Viikon luonti epäonnistui.");
    } finally {
      setGenerating(false);
    }
  }

  if (!booted || (userId && !state && !accountError)) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-shell text-ink">
        <p className="px-4 pt-16 font-display text-3xl tracking-tight">Viikkomenu</p>
      </div>
    );
  }

  if (accountError && !userId) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-shell text-ink">
        <div className="px-4 pt-16">
          <p className="font-display text-3xl tracking-tight">Viikkomenu</p>
          <p className="mt-4 rounded-2xl bg-butter px-4 py-3 text-sm leading-5">{accountError}</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-shell text-ink">
        <AuthView />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-shell text-ink">
        <div className="px-4 pt-16">
          <p className="font-display text-3xl tracking-tight">Viikkomenu</p>
          <p className="mt-4 rounded-2xl bg-butter px-4 py-3 text-sm leading-5">{accountError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-shell text-ink">
      {screen === "generate" ? (
        <GenerateView
          prefs={foodPrefsFromSettings(state.settings)}
          generating={generating}
          error={error}
          nextWeek={generateNext}
          onChange={(prefs) => updateSettings({ ...state.settings, ...prefs })}
          onBack={() => setScreen("week")}
          onSubmit={() => void generate(generateNext ? { next: true } : undefined)}
          onCancel={() => abortRef.current?.abort()}
        />
      ) : (
        <>
          <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
            {screen === "week" ? (
              <WeekView
                key={plan?.id ?? "empty"}
                plan={plan}
                plans={state.plans}
                day={day}
                locks={locks}
                fresh={fresh}
                generating={generating}
                error={error}
                onDay={setDay}
                onGenerate={() => {
                  setGenerateNext(false);
                  setError(null);
                  setScreen("generate");
                }}
                onFill={() => void generate({ fill: true })}
                onNext={() => {
                  setGenerateNext(true);
                  setError(null);
                  updateSettings({ ...state.settings, startDay: "mon", startSlot: "aamiainen" });
                  setScreen("generate");
                }}
                onToggleLock={toggleLock}
                onExample={showExample}
                onOpenShop={() => setScreen("shop")}
                onSelect={selectPlan}
                onDelete={deletePlan}
              />
            ) : null}
            {screen === "shop" ? (
              <ShopView
                plan={plan}
                checked={plan ? (state.checks[plan.id] ?? []) : []}
                onToggle={toggleCheck}
                onClear={() => {
                  if (!plan) return;
                  setState({ ...state, checks: { ...state.checks, [plan.id]: [] } });
                }}
                onGenerate={() => {
                  setGenerateNext(false);
                  setScreen("generate");
                }}
              />
            ) : null}
            {screen === "settings" ? (
              <SettingsView
                settings={state.settings}
                serverKey={serverKey}
                banner={banner}
                onChange={updateSettings}
                onClearPlans={() => setState({ ...state, plans: [], activeId: null, checks: {} })}
                onSignOut={() => {
                  void createClient().auth.signOut();
                }}
              />
            ) : null}
          </main>
          <nav className="no-print fixed bottom-0 left-1/2 z-30 flex w-full max-w-lg -translate-x-1/2 border-t border-line bg-shell/95 px-2 pt-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur">
            <NavButton label="Viikko" selected={screen === "week"} onClick={() => setScreen("week")}>
              <WeekIcon className="h-6 w-6" />
            </NavButton>
            <NavButton label="Ostokset" selected={screen === "shop"} badge={openCount > 0 ? openCount : undefined} onClick={() => setScreen("shop")}>
              <BagIcon className="h-6 w-6" />
            </NavButton>
            <NavButton label="Asetukset" selected={screen === "settings"} onClick={() => setScreen("settings")}>
              <GearIcon className="h-6 w-6" />
            </NavButton>
          </nav>
        </>
      )}
    </div>
  );
}

function NavButton({
  label,
  selected,
  badge,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      className={cx("relative flex flex-1 flex-col items-center gap-0.5 py-1 text-xs font-medium", selected ? "text-ink" : "text-muted")}
    >
      {children}
      {label}
      {badge ? (
        <span className="absolute top-0 right-[22%] min-w-5 rounded-full bg-sage px-1 text-center text-[10px] leading-5 font-semibold text-white">
          {badge > 99 ? "99" : badge}
        </span>
      ) : null}
    </button>
  );
}
