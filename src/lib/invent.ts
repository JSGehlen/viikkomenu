import OpenAI from "openai";
import { z } from "zod";
import { recipeExamplesForPrefs } from "./recipeExamples";
import type { CarbId, Category, FoodPrefs, Ingredient, Meal } from "./types";

export type InventionRequest = {
  brief: string;
  slot: "lounas" | "paivallinen" | "jousto";
  side: CarbId;
};

const CARB = /riisi|pasta|makaron|nuudel|peruna|tortilla/i;
const FAT = /oliiviöljy|oliivioljy|cashew|avokado/i;
const POULTRY = /kana|kalkkuna/i;

const SIDE_ITEM: Record<CarbId, { name: string; grams: number }> = {
  rice: { name: "Riisi", grams: 70 },
  pasta: { name: "Pasta", grams: 70 },
  noodles: { name: "Nuudeli", grams: 70 },
  potato: { name: "Peruna", grams: 300 },
};

const inventedSchema = z.object({
  title: z.string().min(2).max(80),
  kcal: z.coerce.number(),
  proteinG: z.coerce.number(),
  carbsG: z.coerce.number(),
  fatG: z.coerce.number(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        grams: z.coerce.number().default(0),
        pieces: z.coerce.number().default(0),
        ml: z.coerce.number().default(0),
        detail: z.string().max(200).default(""),
      }),
    )
    .min(1)
    .max(12),
  steps: z.array(z.string().min(2).max(400)).min(1).max(10),
});

const INVENTED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "kcal", "proteinG", "carbsG", "fatG", "ingredients", "steps"],
  properties: {
    title: { type: "string" },
    kcal: { type: "integer" },
    proteinG: { type: "integer" },
    carbsG: { type: "integer" },
    fatG: { type: "integer" },
    ingredients: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "grams", "pieces", "ml", "detail"],
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          pieces: { type: "number" },
          ml: { type: "number" },
          detail: { type: "string" },
        },
      },
    },
    steps: { type: "array", minItems: 1, maxItems: 10, items: { type: "string" } },
  },
} as const;

function blocked(title: string, note: string, avoid: string): boolean {
  const words = avoid
    .split(/[,;\n]/)
    .map((part) => part.trim().toLocaleLowerCase("fi"))
    .filter((part) => part.length > 2);
  if (!words.length) return false;
  const blob = `${title} ${note}`.toLocaleLowerCase("fi");
  return words.some((word) => blob.includes(word));
}

function fold(value: string): string {
  return value
    .toLocaleLowerCase("fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function saturdayChoice(
  prefs: FoodPrefs,
): { kind: "library"; title: string } | { kind: "invent"; request: InventionRequest } | null {
  const text = prefs.saturday.trim();
  if (!text) return null;
  const wish = fold(text);
  const hit = recipeExamplesForPrefs(prefs).find((item) => {
    const title = fold(item.title);
    return wish === title || wish.includes(title);
  });
  if (hit) return { kind: "library", title: hit.title };
  return {
    kind: "invent",
    request: { brief: text, slot: "jousto", side: prefs.carbs[0] ?? "rice" },
  };
}

export function inventionRequest(prefs: FoodPrefs): InventionRequest | null {
  const items = recipeExamplesForPrefs(prefs);
  const allowed = items.filter((item) => !blocked(item.title, item.note, prefs.avoid));
  const side = prefs.carbs[1] ?? prefs.carbs[0] ?? "rice";
  if (allowed.filter((item) => item.lunchOk).length < 2) {
    return {
      brief: `Keksi lounassatsi, joka sopii kun vältetään: ${prefs.avoid.trim() || "ei erillistä listaa"}.`,
      slot: "lounas",
      side,
    };
  }
  if (allowed.filter((item) => item.dinnerOk).length < 2) {
    return {
      brief: `Keksi päivällissatsi, joka sopii kun vältetään: ${prefs.avoid.trim() || "ei erillistä listaa"}.`,
      slot: "paivallinen",
      side,
    };
  }
  if (!prefs.inventOne) return null;
  const notes = prefs.notes.trim();
  if (/lauantai/i.test(notes)) return { brief: notes, slot: "jousto", side };
  if (/lounas/i.test(notes)) return { brief: notes || "Keksi uusi lounassatsi.", slot: "lounas", side };
  return { brief: notes || "Keksi uusi päivällissatsi, jota ei ole esimerkkikansiossa.", slot: "paivallinen", side };
}

function categoryOf(name: string): Category {
  if (/jauheliha|kana|lohi|kalkkuna|filee|liha|nakki/i.test(name)) return "meat";
  if (/maito|kerma|juusto|rahka|skyr|raejuusto/i.test(name)) return "dairy";
  if (/muna|valkuainen/i.test(name)) return "dairy";
  if (/paprika|sipuli|kurkku|tomaatti|salaatti|kesäkurpitsa|porkkana|kasvis|parsakaali|pinaatti/i.test(name)) return "produce";
  if (/mustikka|mansikka|banaani|marja/i.test(name)) return "fruit";
  return "dry";
}

function ingredient(name: string, grams: number, pieces = 0, ml = 0, detail = ""): Ingredient {
  return { name, category: categoryOf(name), grams, pieces, ml, detail };
}

function fitRules(meal: Meal, request: InventionRequest): Meal {
  let ingredients = meal.ingredients.filter((item) => item.name.trim());
  if (request.slot === "lounas") {
    ingredients = ingredients.filter((item) => !CARB.test(item.name));
  } else if (request.slot === "paivallinen") {
    const side = SIDE_ITEM[request.side];
    ingredients = ingredients.filter((item) => !CARB.test(item.name));
    const detail = request.side === "potato" ? "raakana, vain tähän päivälliseen" : "kuivana, vain tähän päivälliseen";
    ingredients.push(ingredient(side.name, side.grams, 0, 0, detail));
  }
  const poultry = ingredients.some((item) => POULTRY.test(item.name));
  const minceOrFish = ingredients.some((item) => /jauheliha|lohi/i.test(item.name));
  if (poultry && !minceOrFish && !ingredients.some((item) => FAT.test(item.name))) {
    ingredients.push(ingredient("Oliiviöljy", 15));
  }
  if (minceOrFish) ingredients = ingredients.filter((item) => !/oliiviöljy|oliivioljy/i.test(item.name));
  return { ...meal, ingredients };
}

function promptFor(prefs: FoodPrefs, request: InventionRequest): string {
  const taken = recipeExamplesForPrefs(prefs).map((item) => item.title);
  const side = SIDE_ITEM[request.side];
  const rules =
    request.slot === "paivallinen"
      ? `Päivällinen. Proteiinia noin 150 g. Tasan yksi lisuke: ${side.grams} g ${side.name.toLocaleLowerCase("fi")}. Älä lisää toista lisuketta.`
      : request.slot === "lounas"
        ? "Lounas. Proteiinia noin 150 g ja kasviksia. Ei riisiä, pastaa, nuudelia, perunaa eikä tortillaa."
        : `Lauantain päivän ruoka, ei lounas eikä päivällinen. Aamiainen, välipala ja iltapala ovat jo päivässä. Tee juuri tämä: ${request.brief}. Noin 700–1000 kcal. Herkut ovat vain jäljelle jäävä osuus. Otsikkoon käyttäjän toive.`;
  return [
    "Keksi YKSI uusi satsiruoka yhdelle henkilölle. Älä kopioi esimerkkikansion ruokia.",
    `Älä käytä näitä nimiä: ${taken.join(", ")}.`,
    `Pyyntö: ${request.brief}`,
    `Proteiinit: ${prefs.proteins.join(", ")}. Jauheliha on Atria Kevyt Nauta-Possu 9,5 %, 150 g. Kana tai kalkkuna tarvitsee yhden rasvan: 15 g oliiviöljyä tai 30 g cashewpähkinöitä tai 75 g avokadoa. Jauhelihalle ja lohelle ei lisätä öljyä.`,
    rules,
    prefs.avoid.trim() ? `Vältä: ${prefs.avoid.trim()}` : "",
    "Neljästä kahdeksaan valmistusvaihetta, joissa on lämpö tai aika. Määrät ovat yhdelle annokselle.",
  ]
    .filter(Boolean)
    .join("\n");
}

function wishTitle(request: InventionRequest, generated: string): string {
  const brief = request.brief.trim();
  if (request.slot !== "jousto" || brief.length > 48 || /[.\n]/.test(brief)) return generated;
  return brief.charAt(0).toLocaleUpperCase("fi") + brief.slice(1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function inventMeal(apiKey: string, prefs: FoodPrefs, request: InventionRequest): Promise<Meal> {
  const client = new OpenAI({ apiKey, timeout: 45_000 });
  const payload = {
    model: "gpt-6-luna",
    instructions: "Keksit yhden aterian. Palauta vain pyydetty JSON.",
    input: promptFor(prefs, request),
    max_output_tokens: 2500,
    store: false,
    reasoning: { effort: "low" as const },
    text: {
      format: {
        type: "json_schema" as const,
        name: "invented_meal",
        strict: true,
        schema: INVENTED_JSON_SCHEMA,
      },
    },
  };
  let response;
  try {
    response = await client.responses.create(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/reasoning|unsupported/i.test(message)) throw error;
    const { reasoning: _reasoning, ...rest } = payload;
    response = await client.responses.create(rest);
  }
  const text = response.output_text?.trim() ?? "";
  if (!text) throw new Error("Malli ei palauttanut reseptiä.");
  const parsed = inventedSchema.parse(JSON.parse(text));
  const meal = fitRules(
    {
      slot: request.slot === "jousto" ? "jousto" : request.slot,
      title: wishTitle(request, parsed.title),
      blurb: request.slot === "jousto" ? `Lauantain toive: ${request.brief.trim()}.` : "Keksitty satsi. Tätä ei ole esimerkkikansiossa.",
      kcal: clamp(parsed.kcal, 200, request.slot === "jousto" ? 1600 : 900),
      proteinG: clamp(parsed.proteinG, 0, 80),
      carbsG: clamp(parsed.carbsG, 0, 120),
      fatG: clamp(parsed.fatG, 0, 60),
      ingredients: parsed.ingredients.map((item) =>
        ingredient(item.name, clamp(item.grams, 0, 500), clamp(item.pieces, 0, 6), clamp(item.ml, 0, 400), item.detail),
      ),
      steps: parsed.steps,
      prep: "",
    },
    request,
  );
  return meal;
}
