import { z } from "zod";

export const categorySchema = z.enum([
  "meat",
  "dairy",
  "produce",
  "fruit",
  "dry",
  "frozen",
  "bakery",
  "treats",
  "other",
]);

export const ingredientSchema = z.object({
  name: z.string().min(1),
  category: categorySchema,
  grams: z.number().nonnegative(),
  pieces: z.number().nonnegative(),
  ml: z.number().nonnegative(),
  detail: z.string(),
});

export const mealSchema = z.object({
  slot: z.enum(["aamiainen", "lounas", "valipala", "paivallinen", "iltapala", "jousto"]),
  title: z.string().min(1),
  blurb: z.string(),
  ingredients: z.array(ingredientSchema).min(1).max(12),
  steps: z.array(z.string().min(1)).min(1).max(8),
  kcal: z.number().int().positive(),
  proteinG: z.number().int().nonnegative(),
  carbsG: z.number().int().nonnegative(),
  fatG: z.number().int().nonnegative(),
  prep: z.string(),
});

export const daySchema = z.object({
  prep: z.string(),
  meals: z.array(mealSchema).length(5),
});

export const treatSchema = z.object({
  name: z.string().min(1),
  grams: z.number().nonnegative(),
  pieces: z.number().nonnegative(),
  ml: z.number().nonnegative(),
  kcal: z.number().int().nonnegative(),
  detail: z.string(),
});

export const rawMenuSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  weekdays: z.array(daySchema).length(5),
  saturdayNote: z.string(),
  saturdayMeals: z.array(mealSchema).min(2).max(4),
  saturdayTreats: z.array(treatSchema).max(6),
  sundayPrep: z.string(),
  sunday: z.array(mealSchema).length(5),
});

export const foodPrefsSchema = z.object({
  householdSize: z.union([z.literal(1), z.literal(2)]),
  includeMilk: z.boolean(),
  batchCooking: z.boolean(),
  slowCook: z.boolean(),
  breakfast: z.enum(["porridge", "vary"]),
  snack: z.enum(["skyr", "quark", "vary"]),
  evening: z.enum(["cottage", "vary"]),
  proteins: z.array(z.enum(["beef", "chicken", "turkey", "salmon"])).min(1).max(4),
  carbs: z.array(z.enum(["rice", "pasta", "potato", "noodles"])).min(2).max(4),
  saturday: z.string().max(500),
  avoid: z.string().max(500),
  notes: z.string().max(1000),
  avoidRepeat: z.boolean(),
  inventOne: z.boolean().default(false),
});

export const WEEK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "summary",
    "weekdays",
    "saturdayNote",
    "saturdayMeals",
    "saturdayTreats",
    "sundayPrep",
    "sunday",
  ],
  properties: {
    title: { type: "string", description: "Lyhyt suomenkielinen viikon nimi, enintään 60 merkkiä." },
    summary: { type: "string", description: "Yksi tai kaksi lausetta siitä, mitä viikolla syödään." },
    weekdays: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      description: "Viisi arkipäivää järjestyksessä ma, ti, ke, to, pe. Meal prep: sama lounas ja sama päivällinen toistuvat niillä päivillä, jotka syövät samaa satsia. Täysi resepti vain tekopäivänä.",
      items: { $ref: "#/$defs/day" },
    },
    saturdayNote: { type: "string", description: "Miten lauantain kalorit rakentuvat. Mainitse että luvut ovat arvioita." },
    saturdayMeals: {
      type: "array",
      description: "2–4 vapaata ateriaa. Ei pakollista viiden aterian kaavaa.",
      items: { $ref: "#/$defs/meal" },
    },
    saturdayTreats: {
      type: "array",
      description: "Herkut, jotka mahtuvat päivän kaloriväliin. Tyhjä taulukko jos herkkuja ei ole.",
      items: { $ref: "#/$defs/treat" },
    },
    sundayPrep: { type: "string" },
    sunday: {
      type: "array",
      description: "Viisi ateriaa samassa järjestyksessä kuin arkena. Päivällisellä ei ole erillistä hiilihydraattilisuketta.",
      items: { $ref: "#/$defs/meal" },
    },
  },
  $defs: {
    ingredient: {
      type: "object",
      additionalProperties: false,
      required: ["name", "category", "grams", "pieces", "ml", "detail"],
      properties: {
        name: { type: "string", description: "Tuotteen ostoslistanimi, sama kirjoitusasu joka aterialla." },
        category: {
          type: "string",
          enum: ["meat", "dairy", "produce", "fruit", "dry", "frozen", "bakery", "treats", "other"],
        },
        grams: { type: "number", description: "Grammat yhdelle henkilölle ja yhdelle aterialle. 0 jos määrä on kappaleina tai millilitroina." },
        pieces: { type: "number", description: "Kappalemäärä yhdelle henkilölle. 0 jos määrä on grammoina." },
        ml: { type: "number", description: "Millilitrat. 0 jos ei ole nestettä." },
        detail: { type: "string", description: "Esim. raaka, kuivapaino tai tyhjä." },
      },
    },
    meal: {
      type: "object",
      additionalProperties: false,
      required: ["slot", "title", "blurb", "ingredients", "steps", "kcal", "proteinG", "carbsG", "fatG", "prep"],
      properties: {
        slot: {
          type: "string",
          enum: ["aamiainen", "lounas", "valipala", "paivallinen", "iltapala", "jousto"],
        },
        title: { type: "string" },
        blurb: { type: "string", description: "Yksi lause, miksi ateria sopii suunnitelmaan." },
        ingredients: { type: "array", items: { $ref: "#/$defs/ingredient" } },
        steps: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "string",
            description: "Yksi valmistusvaihe. Lounaassa ja päivällisessä kerro lämpö, aika ja mitä pannulla tai kattilassa tapahtuu. Vähintään neljä vaihetta.",
          },
        },
        kcal: { type: "integer" },
        proteinG: { type: "integer" },
        carbsG: { type: "integer" },
        fatG: { type: "integer" },
        prep: { type: "string", description: "Satsaus- tai annostushuomio, tai tyhjä." },
      },
    },
    day: {
      type: "object",
      additionalProperties: false,
      required: ["prep", "meals"],
      properties: {
        prep: { type: "string", description: "Tämän päivän valmistushuomio, tai tyhjä." },
        meals: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          description: "Aamiainen, lounas, välipala, päivällinen, iltapala. Sama satsi saa toistua useana päivänä.",
          items: { $ref: "#/$defs/meal" },
        },
      },
    },
    treat: {
      type: "object",
      additionalProperties: false,
      required: ["name", "grams", "pieces", "ml", "kcal", "detail"],
      properties: {
        name: { type: "string" },
        grams: { type: "number" },
        pieces: { type: "number" },
        ml: { type: "number" },
        kcal: { type: "integer" },
        detail: { type: "string" },
      },
    },
  },
} as const;
