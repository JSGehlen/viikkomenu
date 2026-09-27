import { assemblePlan } from "@/lib/assemble";
import { CARRY_MARK, carryForward } from "@/lib/carry";
import { dietIssues } from "@/lib/checks";
import { inventBatches, inventionRequest, inventMeal, saturdayChoice } from "@/lib/invent";
import { foodPrefsSchema } from "@/lib/schema";
import { applySpan, includesSlot } from "@/lib/span";
import { CATEGORIES, SLOTS, type DayId, type FoodPrefs, type Meal, type RawMenu } from "@/lib/types";
import { ensureCookDays, expandWeekPlan, fillUnlocked, overlayDays, pickWeek, placeInvented } from "@/lib/weekPlan";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;

const mealSchema = z.object({
  slot: z.enum(SLOTS),
  title: z.string().min(1).max(160),
  blurb: z.string().max(800),
  ingredients: z
    .array(
      z.object({
        name: z.string().max(120),
        category: z.enum(CATEGORIES),
        grams: z.number(),
        pieces: z.number(),
        ml: z.number(),
        detail: z.string().max(200),
      }),
    )
    .max(40),
  steps: z.array(z.string().max(800)).max(30),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  prep: z.string().max(500),
});

const keptMealSchema = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  slot: z.enum(["lounas", "paivallinen"]),
  meal: mealSchema,
});

const bodySchema = z.object({
  model: z.enum(["gpt-6-sol", "gpt-6-luna", "gpt-6-astra"]),
  prefs: foodPrefsSchema,
  previousTitles: z.array(z.string().max(120)).max(20),
  locked: z.array(keptMealSchema).max(14).optional(),
  nextWeek: z.boolean().optional(),
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  previousSunday: z.array(mealSchema).max(8).optional(),
  previousMains: z.array(keptMealSchema).max(10).optional(),
});

async function addInventions(raw: RawMenu, prefs: FoodPrefs, blocked: Set<string>, warnings: string[]): Promise<RawMenu> {
  let dinnerSide = 0;
  const batches = inventBatches(prefs.inventDays)
    .map((batch) => ({
      ...batch,
      days: batch.days.filter((day) => includesSlot(day, batch.slot, prefs) && !blocked.has(`${day}:${batch.slot}`)),
    }))
    .filter((batch) => batch.days.length > 0)
    .map((batch) => {
      const side = batch.slot === "paivallinen" ? (prefs.carbs[dinnerSide++] ?? prefs.carbs[0] ?? "rice") : (prefs.carbs[0] ?? "rice");
      return { ...batch, side };
    });
  if (!batches.length) return raw;
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    warnings.push("Valittuja päiviä ei keksitty, koska OPENAI_API_KEY puuttuu. Ne käyttävät esimerkkireseptejä.");
    return raw;
  }
  const note = prefs.notes.trim();
  let failed = false;
  const made = (
    await Promise.all(
      batches.map(async (batch) => {
        const kind = batch.slot === "lounas" ? "lounassatsi" : "päivällissatsi";
        try {
          const meal = await inventMeal(apiKey, prefs, {
            brief: note ? `${note}. Tee tästä ${kind}.` : `Keksi uusi ${kind}, jota ei ole esimerkkikansiossa.`,
            slot: batch.slot,
            side: batch.side,
            plain: batch.plain,
          });
          return { days: batch.days, slot: batch.slot, meal };
        } catch {
          failed = true;
          return null;
        }
      }),
    )
  ).filter((item): item is { days: DayId[]; slot: "lounas" | "paivallinen"; meal: Meal } => Boolean(item));
  if (failed) warnings.push("Jonkin valitun päivän keksiminen epäonnistui. Se päivä käyttää esimerkkireseptiä.");
  return overlayDays(raw, made, blocked);
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Pyyntö oli virheellinen." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Tarkista viikon valinnat ja yritä uudelleen." }, { status: 400 });
  }

  const prefs = parsed.data.prefs;
  const warnings: string[] = [];
  const locked = [...(parsed.data.locked ?? [])];
  if (parsed.data.nextWeek) {
    for (const item of carryForward(parsed.data.previousSunday ?? [], parsed.data.previousMains ?? [], prefs.householdSize)) {
      if (!locked.some((kept) => kept.day === item.day && kept.slot === item.slot)) locked.push(item);
    }
  }

  let raw: RawMenu;
  if (locked.length) {
    const saturdayPick: { meal?: Meal; title?: string } = {};
    if (!locked.some((item) => item.day === "sat")) {
      const saturday = saturdayChoice(prefs);
      if (saturday?.kind === "library") saturdayPick.title = saturday.title;
      if (saturday?.kind === "invent") {
        const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
        const wish = prefs.saturday.trim();
        if (!apiKey) {
          warnings.push(`Lauantain toivetta "${wish}" ei keksitty, koska OPENAI_API_KEY puuttuu.`);
        } else {
          try {
            saturdayPick.meal = await inventMeal(apiKey, prefs, saturday.request);
          } catch {
            warnings.push(`Lauantain toivetta "${wish}" ei saatu keksittyä. Lauantai käyttää esimerkkireseptiä.`);
          }
        }
      }
    }
    raw = fillUnlocked(prefs, locked, parsed.data.previousTitles, saturdayPick);
  } else {
    let pick = pickWeek(prefs, parsed.data.previousTitles);
    const known = new Map<string, Meal>();
    const saturday = saturdayChoice(prefs);
    if (saturday?.kind === "library") {
      const other = pick.saturdayTitles.find((title) => title !== saturday.title) ?? "Uunilohi";
      pick = { ...pick, saturdayTitles: [saturday.title, other] };
    }
    const idea = inventionRequest(prefs);
    if (idea) {
      const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
      if (!apiKey) {
        warnings.push("Uutta ruokaa ei keksitty, koska OPENAI_API_KEY puuttuu. Viikko käyttää esimerkkireseptejä.");
      } else {
        try {
          const meal = await inventMeal(apiKey, prefs, idea);
          known.set(meal.title, meal);
          pick = placeInvented(pick, meal, idea.slot, idea.side);
        } catch {
          warnings.push("Uuden ruoan keksiminen epäonnistui. Viikko käyttää esimerkkireseptejä.");
        }
      }
    }
    if (saturday?.kind === "invent") {
      const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
      const wish = prefs.saturday.trim();
      if (!apiKey) {
        warnings.push(`Lauantain toivetta "${wish}" ei keksitty, koska OPENAI_API_KEY puuttuu.`);
      } else {
        try {
          const meal = await inventMeal(apiKey, prefs, saturday.request);
          known.set(meal.title, meal);
          pick = placeInvented(pick, meal, "jousto", saturday.request.side);
        } catch {
          warnings.push(`Lauantain toivetta "${wish}" ei saatu keksittyä. Lauantai käyttää esimerkkireseptiä.`);
        }
      }
    }
    raw = expandWeekPlan(pick, prefs, known);
  }

  const blocked = new Set(locked.map((item) => `${item.day}:${item.slot}`));
  raw = await addInventions(raw, prefs, blocked, warnings);
  raw = ensureCookDays(applySpan(raw, prefs), prefs);
  if (locked.some((item) => item.meal.prep.includes(CARRY_MARK))) {
    const onlyCarry = locked.every((item) => item.meal.prep.includes(CARRY_MARK));
    raw = {
      ...raw,
      summary: onlyCarry
        ? "Sunnuntain satsi jatkuu tälle viikolle. Muut ruoat ovat uusia."
        : `${raw.summary} Sunnuntain satsi jatkuu tälle viikolle.`.replace(/\s+/g, " ").trim(),
    };
  }
  const plan = assemblePlan(raw, prefs, {
    warnings: [...warnings, ...dietIssues(raw, prefs)],
    weekOf: parsed.data.weekOf,
  });
  return Response.json({ plan });
}
