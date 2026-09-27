import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { CarbId, Category, Ingredient } from "./types";

export type RecipeVariant = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: Ingredient[];
  steps: string[];
  blurb: string;
};

const FILE_HINT: Record<string, string> = {
  "Szechuan-kana": "kana scezhuan",
  "Lohikulho (wrap ilman tortillaa)": "tonnikalawrap",
  "Lohikastike ja kesäkurpitsanuudelit": "tonnikalakastiketta",
  "Pihvi ja grillikasvikset": "pihvi",
  "Uunikasvikset ja proteiini": "uunikasvikset",
  "Jauheliha-perunavuoka": "jauheliha-peruna",
  "Kanaa ja riisiä uunissa": "kanaa ja riisi",
};

function qtyPattern(): RegExp {
  return /(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(kg|g|dl|ml|rkl|tl|kpl|munaa|munat|muna|valkuaista|valkuaiset|purkkia|purkit|purkki|pussia|pussi)\b/gi;
}

const CARB_WORD = /riis|pasta|nuudel|makaron|perun|tortilla|spaghet|penne|fusill/i;

function norm(value: string): string {
  return value
    .toLocaleLowerCase("fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function num(value: string): number {
  return Number(value.replace(",", "."));
}

function ing(name: string, category: Category, grams = 0, pieces = 0, ml = 0, detail = ""): Ingredient {
  return { name, category, grams, pieces, ml, detail };
}

function categoryOf(name: string): Category {
  if (/jauheliha|kana|lohi|nakki|pihvi|tonnikala|kalkkuna|broileri|filee|liha|makkara/i.test(name)) return "meat";
  if (/maito|kerma|juusto|feta|muna|valkuainen|rahka|kermaviili|raejuusto/i.test(name)) return "dairy";
  if (/pasta|makaron|riis|nuudel|kaura|öljy|oljy|cashew|pähkin|pahkin|tortilla|jauhe|hiutale|kruton/i.test(name)) return "dry";
  if (/pakaste/.test(name)) return "frozen";
  return "produce";
}

function sideKind(name: string): CarbId | null {
  if (/riis/i.test(name)) return "rice";
  if (/nuudel/i.test(name)) return "noodles";
  if (/pasta|makaron|spaghet|penne|fusill/i.test(name)) return "pasta";
  if (/perun/i.test(name)) return "potato";
  return null;
}

function cleanName(raw: string): string {
  const name = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/:/g, " ")
    .replace(/\b\d+\s*[–-]\s*\d+\s+annok\w*/gi, " ")
    .replace(/\b\d+\s+annos\w*/gi, " ")
    .replace(/\b\d+\s+annoks\w*/gi, " ")
    .replace(/\b(noin|enintään|max|yhteensä|kuivaa|kuivat|nosta|käytä|lisää|ota|vuoan pohja|annos|koko erään|koko reseptiin|koko erä|minimaalinen määrä|minimaalinen|maltillisesti|per annos|raakaa)\b/gi, " ")
    .replace(/:aan\b/gi, " ")
    .replace(/[/+=]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.:;\-–%\s]+|[,.:;\-–%\s]+$/g, "")
    .trim();
  if (!name || /^(ei|älä|vain|pieni|määrä|lounaalle|iso|tämä|jaa|sopiva)\b/i.test(name)) return "";
  return name.charAt(0).toLocaleUpperCase("fi") + name.slice(1);
}

function canonicalName(original: string, cleaned: string): string {
  const blob = `${original.split(/\s+tai\s+/i)[0]} ${cleaned}`.toLocaleLowerCase("fi");
  if (/italianpata/.test(blob)) return "Italianpata-pussi";
  if (/jauheliha/.test(blob)) return "Jauheliha 5–10 %";
  if (/makaron/.test(blob)) return "Makaroni";
  if (/nuudel/.test(blob)) return "Nuudeli";
  if (/spaghet|pasta/.test(blob)) return "Pasta";
  if (/riis/.test(blob)) return "Riisi";
  if (/peruna-sipuli|perunasipuli/.test(blob)) return "Peruna-sipulisekoitus";
  if (/perun/.test(blob)) return "Peruna";
  if (/kermaviili/.test(blob)) return "Kevytkermaviili";
  if (/kananmuna|(^|[^a-zäöå])muna/.test(blob)) return "Kananmuna";
  if (/valkuai/.test(blob)) return "Valkuainen";
  if (/maito/.test(blob)) return "Vähärasvainen maito";
  if (/feta/.test(blob)) return "Fetajuusto";
  if (/kerma/.test(blob)) return "Kerma 4 %";
  if (/cashew/.test(blob)) return "Cashewpähkinä";
  if (/tortilla/.test(blob)) return "Tortilla";
  if (/kana|broileri/.test(blob)) return "Kana";
  if (/loh/.test(blob)) return "Lohi";
  if (/kalkkuna/.test(blob)) return "Kalkkunanakki";
  if (/tonnikala/.test(blob)) return "Tonnikala";
  if (/oliiv/.test(blob) && !/öljy|oljy/.test(blob)) return "Oliivi";
  if (/öljy|oljy/.test(blob)) return "Öljy";
  if (/szechuan|schezuan/.test(blob)) return "Szechuan-kastike";
  if (/tomaattikastike|mutti/.test(blob)) return "Tomaattikastike";
  if (/kastike/.test(blob)) return "Kastike";
  if (/wok/.test(blob)) return "Wok-vihannekset";
  if (/paprika/.test(blob)) return "Paprika";
  if (/kesäkurpitsa|kesakurpitsa/.test(blob)) return "Kesäkurpitsa";
  if (/sipul/.test(blob)) return "Sipuli";
  if (/kaurahiutale/.test(blob)) return "Kaurahiutale";
  if (/juusto/.test(blob)) return "Juusto";
  if (/kruton/.test(blob)) return "Krutongit";
  if (/kasvis|vihannes|juures/.test(blob)) return "Kasvikset";
  return cleaned;
}

function sameFood(a: string, b: string): boolean {
  const fold = (value: string) => norm(value).replaceAll("broileri", "kana").replaceAll("file", "");
  const left = fold(a);
  const right = fold(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function portionsIn(text: string): number | null {
  const frac = text.match(/1\/(\d+)\s*[–-]\s*1\/(\d+)/);
  if (frac) return (Number(frac[1]) + Number(frac[2])) / 2;
  const range = text.match(/(\d+)\s*[–-]\s*(\d+)\s+annos/i);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const jaa = text.match(/jaa\s+(?:noin\s+)?(\d+)(?:\s*[–-]\s*(\d+))?\s+annok/i);
  if (jaa) return jaa[2] ? (Number(jaa[1]) + Number(jaa[2])) / 2 : Number(jaa[1]);
  const count = text.match(/annoksia\s+(\d+)/i);
  if (count) return Number(count[1]);
  const single = text.match(/(\d+)\s+annos/i) ?? text.match(/(\d+)\s+annoks/i);
  if (single) return Number(single[1]);
  return null;
}

function round1(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  if (value > 0 && rounded === 0) return 0.1;
  return rounded;
}

function perPortionMatch(chunk: string, match: RegExpMatchArray): boolean {
  const start = (match.index ?? 0) + match[0].length;
  return /\/\s*annos|per\s+annos/i.test(chunk.slice(start, start + 8));
}

function scaleAmount(chunk: string, sentence: string, amount: number, unit: string, portions: number | null): number {
  if (!portions || portions <= 1) return amount;
  if (/\/\s*annos|per\s+annos/i.test(chunk)) return amount;
  const batchSentence = /annosta|annokse|annoksi|yhteensä|koko erään|koko resept/i.test(sentence);
  const batchChunk = /annosta|annokse|annoksi|yhteensä|koko erään|koko resept/i.test(chunk);
  const large =
    unit === "kg" ||
    (unit === "g" && amount >= 400) ||
    (unit === "dl" && amount >= 2) ||
    (/muna|valkuai|purk|pussi/.test(unit) && amount >= 2);
  if (batchSentence || batchChunk || large) return amount / portions;
  return amount;
}

function parseChunk(chunk: string, sentence: string, portions: number | null): Ingredient | null {
  const trimmed = chunk.trim();
  if (!trimmed || /^(ei |älä |pidä |öljyä vain|ei riis|ei erill|lounaalle ei)/i.test(trimmed)) return null;
  const head = trimmed.split(/\s+tai\s+/i)[0];
  const matches = [...head.matchAll(qtyPattern())];
  const chosen = matches.find((match) => perPortionMatch(head, match)) ?? matches[0];
  const cleaned = cleanName(chosen ? head.replace(qtyPattern(), " ") : head);
  let food = canonicalName(head, cleaned);
  if (/^yhteensä|^että |^hiilihydraatti|^proteiini/i.test(food)) {
    const carb = sentence.match(/tortilla|makaron|nuudel|pasta|riisi|riisin|peruna/i);
    food = carb ? canonicalName(carb[0], "") : "";
  }
  if (food.startsWith("(")) return null;
  if (!food || food.length > 48) return null;
  if (!chosen) {
    if (/^(muista|valmista|kuumenna|paista|sekoita|lisää|laita|keitä)/i.test(food)) return null;
    const count = trimmed.match(/^(\d+)\s+\S/);
    if (count && portions && portions > 1) return ing(food, categoryOf(food), 0, round1(Number(count[1]) / portions));
    return ing(food, categoryOf(food));
  }

  const amount = (num(chosen[1]) + (chosen[2] ? num(chosen[2]) : num(chosen[1]))) / 2;
  const unit = chosen[3].toLocaleLowerCase("fi");
  const scaled = scaleAmount(trimmed, sentence, amount, unit, portions);
  const named = /hiilihydraat/i.test(food) && CARB_WORD.test(trimmed) ? canonicalName(trimmed, "") : food;
  const detail = /riis|pasta|nuudel|makaron|spaghet/i.test(named) ? "kuivapaino" : categoryOf(named) === "meat" || categoryOf(named) === "produce" ? "raaka" : /purk/i.test(unit) ? "purkki" : "";

  if (unit === "kg") return ing(named, categoryOf(named), Math.round(scaled * 1000), 0, 0, detail);
  if (unit === "g") return ing(named, categoryOf(named), Math.round(scaled), 0, 0, detail);
  if (unit === "dl") return ing(named, categoryOf(named), 0, 0, Math.round(scaled * 100), detail);
  if (unit === "ml") return ing(named, categoryOf(named), 0, 0, Math.round(scaled), detail);
  if (unit === "rkl") return ing(named, categoryOf(named), 0, 0, Math.round(scaled * 15), detail);
  if (unit === "tl") return ing(named, categoryOf(named), 0, 0, Math.round(scaled * 5), detail);
  return ing(named || canonicalName(unit, unit), categoryOf(named || unit), 0, round1(scaled), 0, detail);
}

function slashCarbs(chunk: string): string[] {
  const match = chunk.match(/((?:[a-zäöåA-ZÄÖÅ]{3,}\/){1,3}[a-zäöåA-ZÄÖÅ]{3,})/);
  if (!match) return [chunk];
  const words = match[1].split("/").filter((word) => CARB_WORD.test(word));
  if (words.length < 2) return [chunk];
  return words.map((word) => chunk.replace(match[1], word));
}

function piecesOf(sentence: string): string[] {
  if (/^(ei |älä |lounaalle ei|öljyä vain)/i.test(sentence.trim())) return [];
  const chunks: string[] = [];
  for (const piece of sentence.split(/\s+\+\s+|\s*;\s*|\s*,\s*/)) {
    const alts = piece.split(/\s+TAI\s+|\s+tai\s+/i).map((alt) => alt.trim()).filter(Boolean);
    const bothQuantified = alts.length > 1 && alts.every((alt) => qtyPattern().test(alt));
    const expanded = (bothQuantified ? alts : [piece]).flatMap((alt) => slashCarbs(alt.trim()));
    const carbAlts = expanded.filter((alt) => CARB_WORD.test(alt));
    chunks.push(...(expanded.length > 1 && carbAlts.length >= 2 ? expanded : [expanded[0] || piece]));
  }
  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}

function amountOf(item: Ingredient): number {
  return item.grams + item.ml + item.pieces;
}

function addIngredient(list: Ingredient[], item: Ingredient | null): void {
  if (!item) return;
  if (/^\d|vuoasta/i.test(item.name)) return;
  const index = list.findIndex((current) => sameFood(current.name, item.name));
  if (index === -1) {
    list.push(item);
    return;
  }
  if (amountOf(list[index]) === 0 && amountOf(item) > 0) list[index] = item;
}

function ingredientsFrom(text: string, portions: number | null): Ingredient[] {
  const list: Ingredient[] = [];
  for (const sentence of text.split(/(?<=[.!])\s+(?=[A-ZÄÖÅ0-9])/)) {
    for (const chunk of piecesOf(sentence)) addIngredient(list, parseChunk(chunk, sentence, portions));
  }
  return list;
}

function isInstruction(line: string): boolean {
  return /^(kuumenna|tee|kaada|paloittele|asettele|sekoita|paista|lisää|laita|ruskista|keitä|anna|voitele|nauti|pilko|levitä|trimmaa|hiero|valmista|muista|leikkaa|mausta|kypsennä|tarkista|ota|nosta|pyörittele|hienonna|jätä|taita|kasaa|valitse|aseta|pinnalle|homma|ruoka|keitä|kun |tämän|seuraavaksi|sitten)/i.test(
    line,
  );
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[-*]\s*/, "")
    .split(/(?<=[.!])\s+(?=[A-ZÄÖÅ0-9])/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length >= 8 && !/^annoksia\b/i.test(line) && !/^\*?\s*1\s+annos\b/i.test(line));
}

function ovenStep(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const temp = flat.match(/(\d+)\s*°?\s*c/i);
  const rest = flat.replace(/(\d+)\s*°?\s*c/i, "").replace(/^[,.\s]+/, "").trim();
  return ["Uuni", temp ? `${temp[1]} °C` : "", rest].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

type Block = { heading: string; body: string };

function blocksOf(part: string): Block[] {
  const marks = [...part.matchAll(/^###\s+(.+)$/gm)];
  return marks.map((mark, index) => {
    const start = (mark.index ?? 0) + mark[0].length;
    const end = marks[index + 1]?.index ?? part.length;
    return { heading: mark[1].trim(), body: part.slice(start, end).replace(/\n---\s*$/g, "").trim() };
  });
}

function bodyOf(blocks: Block[], pattern: RegExp): string {
  return blocks.find((block) => pattern.test(block.heading))?.body ?? "";
}

function bulletLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function nutritionOf(part: string): Pick<RecipeVariant, "kcal" | "proteinG" | "carbsG" | "fatG"> {
  const match = part.match(/(\d+)\s*kcal.*?proteiini\s*(\d+)\s*g.*?hiilihydraatit\s*(\d+)\s*g.*?rasva\s*(\d+)\s*g/i);
  if (!match) return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  return { kcal: Number(match[1]), proteinG: Number(match[2]), carbsG: Number(match[3]), fatG: Number(match[4]) };
}

function stepsOf(blocks: Block[]): string[] {
  const steps = sentences(bodyOf(blocks, /valmistus/i));
  for (const block of blocks) {
    if (/valmistus|ainekset/i.test(block.heading)) continue;
    if (/uuni/i.test(block.heading)) {
      const step = ovenStep(block.body);
      if (step.length > 8) steps.push(step);
      continue;
    }
    const line = `${block.heading}: ${block.body.replace(/\s+/g, " ").replace(/^[-*]\s*/gm, "").trim()}`;
    if (line.length > 12) steps.push(line);
  }
  for (const line of bulletLines(bodyOf(blocks, /^ainekset$/i))) {
    if (isInstruction(line)) steps.push(line.replace(/\s+/g, " "));
  }
  return steps.filter((step) => !step.includes("###"));
}

function variantFrom(part: string, inherit: Ingredient[]): RecipeVariant {
  const blocks = blocksOf(part);
  const dose = bodyOf(blocks, /annostelu/i);
  const portions = portionsIn(`${dose}\n${bodyOf(blocks, /valmistus/i)}`);
  const ingredients: Ingredient[] = [];
  for (const item of ingredientsFrom(dose, portions)) addIngredient(ingredients, item);
  for (const line of bulletLines(bodyOf(blocks, /^ainekset$/i))) {
    if (!isInstruction(line)) addIngredient(ingredients, parseChunk(line, line, portions));
  }
  for (const item of inherit) {
    if (!CARB_WORD.test(item.name)) addIngredient(ingredients, item);
  }
  const nutrition = nutritionOf(part);
  const blurb = dose.replace(/\s+/g, " ").trim();
  return {
    ...nutrition,
    ingredients,
    steps: stepsOf(blocks),
    blurb: blurb.length > 180 ? `${blurb.slice(0, 177)}…` : blurb,
  };
}

type FileParts = { lunch: string; dinner: string };

let cache: Map<string, FileParts> | null = null;

function library(): Map<string, FileParts> {
  if (cache) return cache;
  cache = new Map();
  const dir = path.join(process.cwd(), "receipe-examples");
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".md"));
  } catch {
    return cache;
  }
  for (const file of files) {
    const text = readFileSync(path.join(dir, file), "utf8");
    const [lunch, dinner] = text.split(/##\s+Illall/i);
    const key = norm(file.replace(/\.md$/i, ""));
    if (!cache.has(key)) cache.set(key, { lunch: lunch ?? "", dinner: dinner ?? lunch ?? "" });
  }
  return cache;
}

function partsFor(title: string): FileParts | undefined {
  const files = library();
  const hint = norm(FILE_HINT[title] ?? title);
  const direct = files.get(hint);
  if (direct) return direct;
  return [...files.entries()].find(([name]) => name.includes(hint) || hint.includes(name))?.[1];
}

export function loadRecipeVariant(title: string, dinner: boolean): RecipeVariant | null {
  const parts = partsFor(title);
  if (!parts) return null;
  const lunch = variantFrom(parts.lunch, []);
  if (!dinner) return lunch;
  return variantFrom(parts.dinner, lunch.ingredients);
}

export function selectSide(ingredients: Ingredient[], side?: CarbId): Ingredient[] {
  if (!side) return ingredients;
  const carbs = ingredients.filter((item) => sideKind(item.name));
  const kinds = [...new Set(carbs.map((item) => sideKind(item.name)).filter((kind): kind is CarbId => Boolean(kind)))];
  if (kinds.length <= 1) return ingredients;
  const chosen = carbs.find((item) => sideKind(item.name) === side) ?? carbs[0];
  return [...ingredients.filter((item) => !sideKind(item.name)), chosen];
}

export function hasDishCarb(ingredients: Ingredient[]): boolean {
  return ingredients.some((item) => sideKind(item.name));
}
