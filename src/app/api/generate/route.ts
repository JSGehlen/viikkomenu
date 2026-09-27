import { generateMenu } from "@/lib/openai";
import { foodPrefsSchema } from "@/lib/schema";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  model: z.enum(["gpt-6-sol", "gpt-6-luna", "gpt-6-astra"]),
  prefs: foodPrefsSchema,
  previousTitles: z.array(z.string().max(120)).max(20),
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

  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return Response.json({ error: "Lisää OPENAI_API_KEY tiedostoon .env.local ja käynnistä sovellus uudelleen." }, { status: 400 });
  }

  try {
    const plan = await generateMenu({ apiKey, ...parsed.data });
    return Response.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Viikon luonti epäonnistui.";
    return Response.json({ error: message }, { status: 502 });
  }
}
