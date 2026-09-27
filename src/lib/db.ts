import { foodPrefsFromSettings, normalizeCarbs, normalizeInventDays, DEFAULT_FOOD_PREFS, DEFAULT_SETTINGS } from "./prefs";
import { clearLegacy, readLegacy } from "./storage";
import { createClient } from "./supabase/client";
import type { FoodPrefs, ModelId, Persisted, Settings, WeekPlan } from "./types";

const MODELS = new Set<ModelId>(["gpt-6-sol", "gpt-6-luna", "gpt-6-astra"]);

export function accountSnapshot(state: Persisted): string {
  return JSON.stringify(state);
}

function prefsFromJson(value: unknown): FoodPrefs {
  const source = value && typeof value === "object" ? (value as Partial<FoodPrefs> & { carb?: string }) : {};
  const { carb: _legacyCarb, ...raw } = source;
  const proteins = Array.isArray(raw.proteins)
    ? raw.proteins.filter((item): item is FoodPrefs["proteins"][number] =>
        item === "beef" || item === "chicken" || item === "turkey" || item === "salmon",
      )
    : [];
  return {
    ...DEFAULT_FOOD_PREFS,
    ...raw,
    householdSize: raw.householdSize === 2 ? 2 : 1,
    proteins: proteins.length > 0 ? proteins : DEFAULT_FOOD_PREFS.proteins,
    breakfast: raw.breakfast === "vary" ? "vary" : "porridge",
    snack: raw.snack === "quark" || raw.snack === "vary" ? raw.snack : "skyr",
    evening: raw.evening === "vary" ? "vary" : "cottage",
    carbs: normalizeCarbs(raw.carbs),
    saturday: typeof raw.saturday === "string" ? raw.saturday : "",
    avoid: typeof raw.avoid === "string" ? raw.avoid : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    includeMilk: raw.includeMilk !== false,
    batchCooking: raw.batchCooking !== false,
    slowCook: raw.slowCook === true,
    avoidRepeat: raw.avoidRepeat !== false,
    inventOne: raw.inventOne === true,
    inventDays: normalizeInventDays(raw.inventDays),
    startDay:
      raw.startDay === "tue" || raw.startDay === "wed" || raw.startDay === "thu" || raw.startDay === "fri" || raw.startDay === "sat" || raw.startDay === "sun"
        ? raw.startDay
        : "mon",
    startSlot:
      raw.startSlot === "lounas" || raw.startSlot === "valipala" || raw.startSlot === "paivallinen" || raw.startSlot === "iltapala"
        ? raw.startSlot
        : "aamiainen",
  };
}

function isPlan(value: unknown): value is WeekPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<WeekPlan>;
  return typeof plan.id === "string" && Array.isArray(plan.shopping) && (Array.isArray(plan.weekdays) || Array.isArray(plan.weekday));
}

function settingsFrom(model: unknown, prefs: unknown): Settings {
  return {
    ...prefsFromJson(prefs),
    model: typeof model === "string" && MODELS.has(model as ModelId) ? (model as ModelId) : DEFAULT_SETTINGS.model,
  };
}

function groupChecks(rows: Array<{ week_id: string; item_id: string }>): Record<string, string[]> {
  const checks: Record<string, string[]> = {};
  for (const row of rows) {
    checks[row.week_id] = [...(checks[row.week_id] ?? []), row.item_id];
  }
  return checks;
}

async function userId() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Kirjaudu sisään uudelleen.");
  return data.user.id;
}

export async function loadAccount(): Promise<Persisted> {
  const supabase = createClient();
  const id = await userId();
  const [profileRes, weeksRes, checksRes] = await Promise.all([
    supabase.from("profiles").select("model, prefs, active_week_id").eq("user_id", id).maybeSingle(),
    supabase.from("weeks").select("plan, created_at").order("created_at", { ascending: false }),
    supabase.from("shopping_checks").select("week_id, item_id"),
  ]);
  if (profileRes.error || weeksRes.error || checksRes.error) {
    throw new Error("Tietoja ei saatu ladattua.");
  }

  let plans = (weeksRes.data ?? []).map((row) => row.plan).filter(isPlan);
  let checks = groupChecks(checksRes.data ?? []);
  let model = profileRes.data?.model;
  let prefs = profileRes.data?.prefs;
  let activeId = profileRes.data?.active_week_id ?? null;

  const legacy = readLegacy();
  if (plans.length === 0 && legacy && legacy.plans.length > 0) {
    const migrated: Persisted = {
      settings: settingsFrom(legacy.settings.model, foodPrefsFromSettings(legacy.settings)),
      plans: legacy.plans,
      activeId: legacy.activeId,
      checks: legacy.checks,
    };
    await saveAccount(migrated);
    clearLegacy();
    plans = migrated.plans;
    checks = migrated.checks;
    model = migrated.settings.model;
    prefs = foodPrefsFromSettings(migrated.settings);
    activeId = migrated.activeId;
  }

  const settings = settingsFrom(model, prefs);
  if (!profileRes.data && plans.length === 0) {
    await saveAccount({ settings, plans: [], activeId: null, checks: {} });
  }

  return {
    settings,
    plans,
    activeId: plans.some((plan) => plan.id === activeId) ? activeId : (plans[0]?.id ?? null),
    checks,
  };
}

export async function saveAccount(state: Persisted) {
  const supabase = createClient();
  const id = await userId();
  const plans = state.plans.filter(isPlan);
  const activeId = plans.some((plan) => plan.id === state.activeId) ? state.activeId : null;

  if (plans.length > 0) {
    const { error } = await supabase.from("weeks").upsert(
      plans.map((plan) => ({
        user_id: id,
        id: plan.id,
        created_at: plan.createdAt,
        plan,
      })),
      { onConflict: "user_id,id" },
    );
    if (error) throw new Error("Viikkoa ei saatu tallennettua.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: id,
      model: state.settings.model,
      prefs: foodPrefsFromSettings(state.settings),
      active_week_id: activeId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (profileError) throw new Error("Asetuksia ei saatu tallennettua.");

  let removal = supabase.from("weeks").delete().eq("user_id", id);
  if (plans.length > 0) {
    removal = removal.not("id", "in", `(${plans.map((plan) => `"${plan.id}"`).join(",")})`);
  }
  const { error: removeError } = await removal;
  if (removeError) throw new Error("Vanhaa viikkoa ei saatu poistettua.");

  const { error: clearError } = await supabase.from("shopping_checks").delete().eq("user_id", id);
  if (clearError) throw new Error("Ostoslistaa ei saatu tallennettua.");

  const rows = plans.flatMap((plan) =>
    (state.checks[plan.id] ?? []).map((itemId) => ({
      user_id: id,
      week_id: plan.id,
      item_id: itemId,
    })),
  );
  if (rows.length > 0) {
    const { error } = await supabase.from("shopping_checks").insert(rows);
    if (error) throw new Error("Ostoslistaa ei saatu tallennettua.");
  }
}
