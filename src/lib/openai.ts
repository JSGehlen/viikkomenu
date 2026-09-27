import OpenAI from "openai";
import { assemblePlan } from "./assemble";
import { dietIssues } from "./checks";
import type { FoodPrefs, ModelId, WeekPlan } from "./types";
import { WEEK_PLAN_SCHEMA, buildPickerPrompt, expandWeekPlan, weekPlanSchema } from "./weekPlan";

function redact(value: string): string {
  return value.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-…").slice(0, 180);
}

function responseText(response: { output_text?: string }): string {
  return response.output_text?.trim() ?? "";
}

async function complete(apiKey: string, model: ModelId, input: string): Promise<string> {
  const client = new OpenAI({ apiKey, timeout: 90_000 });
  const request = {
    model,
    instructions: "Valitset meal prep -viikon otsikoista. Älä kirjoita reseptejä.",
    input,
    max_output_tokens: 1200,
    store: false,
    reasoning: { effort: "low" as const },
    text: {
      format: {
        type: "json_schema" as const,
        name: "week_plan",
        strict: true,
        schema: WEEK_PLAN_SCHEMA,
      },
    },
  };

  let response;
  try {
    response = await client.responses.create(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/reasoning|unsupported/i.test(message)) throw error;
    const { reasoning: _reasoning, ...rest } = request;
    response = await client.responses.create(rest);
  }

  if (response.status === "incomplete") {
    throw new Error("Vastaus katkesi ennen kuin viikko valmistui. Yritä uudelleen.");
  }
  const text = responseText(response);
  if (!text) throw new Error("Malli ei palauttanut viikkoa. Yritä uudelleen.");
  return text;
}

export async function generateMenu(options: {
  apiKey: string;
  model: ModelId;
  prefs: FoodPrefs;
  previousTitles: string[];
}): Promise<WeekPlan> {
  let feedback = "";
  let lastError = "Malli ei palauttanut käyttökelpoista viikkoa. Yritä uudelleen.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const avoid = options.previousTitles.length ? `Älä valitse näitä, jos muita löytyy: ${options.previousTitles.join(", ")}.` : "";
    const prompt = [buildPickerPrompt(options.prefs), avoid, feedback ? `Korjaa edellinen vastaus:\n${feedback}` : ""]
      .filter(Boolean)
      .join("\n\n");
    let text = "";
    try {
      text = await complete(options.apiKey, options.model, prompt);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401) throw new Error("OpenAI-avain ei kelpaa. Tarkista OPENAI_API_KEY tiedostosta .env.local.");
        if (error.status === 429) throw new Error("OpenAI rajoitti pyynnön tai käyttösaldo loppui.");
        if (error.status === 404) throw new Error("Mallia ei löytynyt. Valitse asetuksista toinen malli.");
        throw new Error(`OpenAI-pyyntö epäonnistui. ${redact(error.message)}`);
      }
      throw error instanceof Error ? new Error(redact(error.message)) : new Error(lastError);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      feedback = "Vastaus ei ollut validia JSONia. Palauta vain skeeman mukainen objekti.";
      lastError = "Vastaus ei sopinut viikon rakenteeseen. Yritä uudelleen.";
      continue;
    }

    const parsed = weekPlanSchema.safeParse(json);
    if (!parsed.success) {
      feedback = parsed.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      lastError = "Vastaus ei sopinut viikon rakenteeseen. Yritä uudelleen.";
      continue;
    }

    const raw = expandWeekPlan(parsed.data, options.prefs);
    const issues = dietIssues(raw, options.prefs);
    return assemblePlan(raw, options.prefs, { warnings: issues });
  }

  throw new Error(lastError);
}
