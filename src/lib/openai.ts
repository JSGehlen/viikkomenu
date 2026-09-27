import OpenAI from "openai";
import { assemblePlan } from "./assemble";
import { dietIssues } from "./checks";
import { buildUserPrompt, SYSTEM_PROMPT } from "./rules";
import { WEEK_JSON_SCHEMA, rawMenuSchema } from "./schema";
import type { FoodPrefs, ModelId, WeekPlan } from "./types";

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
    instructions: SYSTEM_PROMPT,
    input,
    max_output_tokens: 16000,
    store: false,
    reasoning: { effort: "low" as const },
    text: {
      format: {
        type: "json_schema" as const,
        name: "week_menu",
        strict: true,
        schema: WEEK_JSON_SCHEMA,
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
    const prompt = [buildUserPrompt(options.prefs, options.previousTitles), feedback ? `Korjaa edellinen vastaus:\n${feedback}` : ""]
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

    const parsed = rawMenuSchema.safeParse(json);
    if (!parsed.success) {
      feedback = parsed.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      lastError = "Vastaus ei sopinut viikon rakenteeseen. Yritä uudelleen.";
      continue;
    }

    const issues = dietIssues(parsed.data, options.prefs);
    if (issues.length === 0 || attempt === 1) {
      return assemblePlan(parsed.data, options.prefs, { warnings: issues });
    }
    feedback = issues.join("\n");
    lastError = issues[0] ?? lastError;
  }

  throw new Error(lastError);
}
