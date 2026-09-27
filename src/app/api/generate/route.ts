import { assemblePlan } from "@/lib/assemble";
import { dietIssues } from "@/lib/checks";
import { inventionRequest, inventMeal, saturdayChoice } from "@/lib/invent";
import { foodPrefsSchema } from "@/lib/schema";
import { CATEGORIES, SLOTS, type Meal } from "@/lib/types";
import { expandWeekPlan, fillUnlocked, pickWeek, placeInvented } from "@/lib/weekPlan";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 45;

const keptMealSchema = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  slot: z.enum(["lounas", "paivallinen"]),
  meal: z.object({
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
  }),
});

const bodySchema = z.object({
  model: z.enum(["gpt-6-sol", "gpt-6-luna", "gpt-6-astra"]),
  prefs: foodPrefsSchema,
  previousTitles: z.array(z.string().max(120)).max(20),
  locked: z.array(keptMealSchema).max(14).optional(),
});

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
  const locked = parsed.data.locked ?? [];
  if (locked.length) {
    const raw = fillUnlocked(prefs, locked, parsed.data.previousTitles);
    const plan = assemblePlan(raw, prefs, { warnings: dietIssues(raw, prefs) });
    return Response.json({ plan });
  }

  let pick = pickWeek(prefs, parsed.data.previousTitles);
  const known = new Map<string, Meal>();
  const warnings: string[] = [];
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
  const raw = expandWeekPlan(pick, prefs, known);
  const plan = assemblePlan(raw, prefs, { warnings: [...warnings, ...dietIssues(raw, prefs)] });
  return Response.json({ plan });
}
