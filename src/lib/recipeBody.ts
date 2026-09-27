import { readFileSync } from "node:fs";
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
  "Kanaa ja riisiä uunissa": "kana uunissa",
  Kanasalaatti: "kanafilee ja kasvikset",
};

function qtyPattern(): RegExp {
  return /(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(kg|g|dl|ml|rkl|tl|kpl|munaa|munat|muna|valkuaista|valkuaiset|purkkia|purkit|purkki|pussia|pussi)\b/gi;
}

const CARB_WORD = /riis|pasta|nuudel|makaron|perun|tortilla|spaget|penne|fusill/i;

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
  if (/pasta|makaron|spaget|penne|fusill/i.test(name)) return "pasta";
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
  const blob = `${original} ${cleaned}`.toLocaleLowerCase("fi");
  if (/italianpata/.test(blob)) return "Italianpata-pussi";
  if (/jauheliha/.test(blob)) return "Jauheliha 5–10 %";
  if (/makaron/.test(blob)) return "Makaroni";
  if (/nuudel/.test(blob)) return "Nuudeli";
  if (/spaget|pasta/.test(blob)) return "Pasta";
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

function scaleAmount(chunk: string, amount: number, portions: number | null): number {
  if (!portions || portions <= 1) return amount;
  if (/\/\s*annos|per\s+annos|annokseen/i.test(chunk)) return amount;
  return amount / portions;
}

function parseChunk(chunk: string, sentence: string, portions: number | null): Ingredient | null {
  const trimmed = chunk
    .trim()
    .replace(/muita\s+kuin\s+perunakasviksia/gi, "kasviksia")
    .replace(/\b(ei|älä|ilman)\b[^.;]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed || /^(ei |älä |pidä |öljyä vain|ei riis|ei erill|lounaalle ei)/i.test(trimmed)) return null;
  const head = trimmed.split(/\s+tai\s+/i)[0];
  const matches = [...head.matchAll(qtyPattern())];
  const chosen = matches.find((match) => perPortionMatch(head, match)) ?? matches[0];
  const cleaned = cleanName(chosen ? head.replace(qtyPattern(), " ") : head);
  let food = canonicalName(trimmed, cleaned);
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
  const scaled = scaleAmount(trimmed, amount, portions);
  const named = /hiilihydraat/i.test(food) && CARB_WORD.test(trimmed) ? canonicalName(trimmed, "") : food;
  const detail = /riis|pasta|nuudel|makaron|spaget/i.test(named) ? "kuivapaino" : categoryOf(named) === "meat" || categoryOf(named) === "produce" ? "raaka" : /purk/i.test(unit) ? "purkki" : "";

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
  for (const piece of sentence.split(/\s+\+\s+|\s+ja\s+|\s*;\s*|(?<!\d)\s*,\s*(?!\d)/)) {
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

function addIngredient(list: Ingredient[], item: Ingredient | null, prefer = false): void {
  if (!item) return;
  if (amountOf(item) === 0 && /valitse|huomio|rasvaero|jos |riippuu|tarkista|aloita|maista|pakkaus|tarvittaessa|päivällisannos|sama pohja|lisäksi|energia|annosten|ohjeen mukaan|⅛|fileetä|annostele|makrot |kypsennet|purkkikoko|vaikuttavat|kastikkeesta|päivälliselle/i.test(item.name)) return;
  if (amountOf(item) === 0 && /^(vesi|vettä|sipuli|paprika|pippuria|mustapippuria|suolaa|chiliä|mausteita|mausteet|muita kuivia mausteita)$/i.test(item.name)) return;
  if (/^\d|vuoasta/i.test(item.name)) return;
  const index = list.findIndex((current) => sameFood(current.name, item.name));
  if (index === -1) {
    list.push(item);
    return;
  }
  if ((prefer && amountOf(item) > 0) || (amountOf(list[index]) === 0 && amountOf(item) > 0)) list[index] = item;
}

function ingredientsFrom(text: string, portions: number | null): Ingredient[] {
  const list: Ingredient[] = [];
  const lines = text.split(/\n/).flatMap((line) => line.replace(/^[-*]\s*/, "").split(/(?<=[.!])\s+(?=[A-ZÄÖÅ0-9])/));
  for (const sentence of lines) {
    for (const chunk of piecesOf(sentence)) addIngredient(list, parseChunk(chunk, sentence, portions));
  }
  return list;
}

function isInstruction(line: string): boolean {
  return /^(kuumenna|tee|kaada|paloittele|asettele|sekoita|paista|lisää|laita|ruskista|keitä|anna|voitele|nauti|pilko|levitä|trimmaa|hiero|valmista|muista|leikkaa|mausta|kypsennä|tarkista|ota|nosta|pyörittele|hienonna|jätä|taita|kasaa|valitse|aseta|pinnalle|homma|ruoka|keitä|kun |tämän|seuraavaksi|sitten)/i.test(
    line,
  );
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

function instructionSteps(body: string): string[] {
  const flat = body.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (!flat) return [];
  const parts = flat
    .split(/(?<=[.!])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && !/^(ei |älä |korjaus|tarkennus|huomio)\b/i.test(line));
  if (parts.length >= 4) return parts;
  const clauses = flat
    .split(/(?<=[.!])\s+|\s*,\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && !/^(ei |älä )/i.test(line));
  return clauses.length >= parts.length ? clauses : parts;
}

function stepsOf(blocks: Block[]): string[] {
  const steps = instructionSteps(blocks.filter((block) => /valmistus/i.test(block.heading)).map((block) => block.body).join(" "));
  for (const block of blocks) {
    if (/valmistus|ainekset|lounas|illallis|annos|lisuke|huomio|tarkennus|korjaus/i.test(block.heading)) continue;
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
  const seen = new Set<string>();
  return steps.filter((step) => {
    if (step.includes("###") || seen.has(step)) return false;
    seen.add(step);
    return true;
  });
}

function variantFrom(part: string, inherit: Ingredient[]): RecipeVariant {
  const blocks = blocksOf(part);
  const dose = bodyOf(blocks, /annostelu/i).replace(/\*\*/g, "");
  const stated = yieldBounds(part);
  const counted = portionsIn(`${dose}\n${bodyOf(blocks, /valmistus/i)}`);
  const portions = counted && counted >= 2 ? counted : (stated?.high ?? counted);
  const perLine = dose.match(/Per annos:\s*([^\n]+)/i)?.[1] ?? "";
  const batchDose = dose.replace(/Per annos:[^\n]+/i, "");
  const ingredients: Ingredient[] = [];
  for (const item of ingredientsFrom(batchDose, portions)) addIngredient(ingredients, item);
  for (const item of ingredientsFrom(perLine, null)) addIngredient(ingredients, item, true);
  let sideText = bodyOf(blocks, /lisuke/i).replace(/\*\*/g, "");
  sideText = sideText.replace(/(\d+)\s*g([^.(]{0,80})\((\d+)\s*g\s*\/\s*annos\)/gi, "$3 g$2");
  sideText = sideText
    .replace(/\([^)]*\)/g, " ")
    .replace(/,?\s*yhteensä\b[^.]*/gi, "")
    .split(/(?<=[.!])\s+/)
    .filter((line) => !/keitä |annostele|meal prep|eräannostelu|tärkeä|kcal|tuotetieto|älä merkitse/i.test(line))
    .join(" ");
  for (const item of ingredientsFrom(sideText, null)) addIngredient(ingredients, item);
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

export type LibraryDish = {
  title: string;
  proteins: Array<"beef" | "chicken" | "turkey" | "salmon">;
  dinnerSides: CarbId[];
  lunchOk: boolean;
  dinnerOk: boolean;
  saturdayFit?: boolean;
  potatoGrams?: 250 | 300;
  note: string;
};

let cache: Map<string, FileParts> | null = null;
let dishCache: LibraryDish[] | null = null;

function asOldPart(version: string): string {
  let text = version.replace(/^#### /gm, "### ").replace(/^###\s+(?:Lounas|Illallis)[^\n]*\n/gim, "");
  const portion = text.match(/\*\*(?:\d+\s*[–-]\s*\d+|\d+)\s+annos(?:ta)?\.\*\*/)?.[0] ?? "";
  if (!/###\s+(?:Ainekset|Annostelu)/i.test(text)) {
    const methodAt = text.search(/^###\s+Valmistus/im);
    if (methodAt >= 0) return `### Annostelu\n${portion}\n${text.slice(0, methodAt)}${text.slice(methodAt)}`;
    return `### Annostelu\n${portion}\n${text}\n### Valmistus\n${text}`;
  }
  if (portion) {
    text = text.replace(/(###\s+Ainekset ja annostelu\s*\n|###\s+Annostelu\s*\n)/i, `$1${portion}\n`);
  }
  return text;
}

function proteinsOf(blob: string): LibraryDish["proteins"] {
  const food = blob.replace(/kananmun/g, " ");
  const ids: LibraryDish["proteins"] = [];
  if (/jauheliha|nauta|pihvi/.test(food)) ids.push("beef");
  if (/(^|[^a-zäöå])(kana|broileri)/.test(food)) ids.push("chicken");
  if (/kalkkuna|nakki/.test(food)) ids.push("turkey");
  if (/lohi|tonnikala/.test(food)) ids.push("salmon");
  return ids.length ? ids : ["beef"];
}

function sidesOf(text: string): CarbId[] {
  const ids: CarbId[] = [];
  if (/riis/i.test(text)) ids.push("rice");
  if (/pasta|makaron|spaget/i.test(text)) ids.push("pasta");
  if (/nuudel/i.test(text)) ids.push("noodles");
  if (/perun/i.test(text)) ids.push("potato");
  return ids;
}

function library(): Map<string, FileParts> {
  if (cache && dishCache) return cache;
  cache = new Map();
  dishCache = [];
  const folder = path.join(process.cwd(), "receipe-examples");
  let lunchText = "";
  let dinnerText = "";
  try {
    lunchText = readFileSync(path.join(folder, "lunches.md"), "utf8");
    dinnerText = readFileSync(path.join(folder, "dinners.md"), "utf8");
  } catch {
    return cache;
  }
  const lunches = new Map(recipeSections(lunchText).map((item) => [norm(item.title), item]));
  const dinners = new Map(recipeSections(dinnerText).map((item) => [norm(item.title), item]));
  const titles = new Map<string, string>();
  for (const item of lunches.values()) titles.set(norm(item.title), item.title);
  for (const item of dinners.values()) if (!titles.has(norm(item.title))) titles.set(norm(item.title), item.title);
  for (const [key, title] of titles) {
    const lunch = lunches.get(key);
    const dinner = dinners.get(key);
    const lunchPart = lunch ? asOldPart(lunch.body) : null;
    const dinnerPart = dinner ? asOldPart(dinner.body) : null;
    if (!lunchPart && !dinnerPart) continue;
    cache.set(key, { lunch: lunchPart ?? "", dinner: dinnerPart ?? lunchPart ?? "" });
    const blob = `${title}\n${lunchPart ?? ""}\n${dinnerPart ?? ""}`.toLocaleLowerCase("fi");
    const dinnerSides = sidesOf(dinnerPart || lunchPart || "");
    const portions = yieldBounds(dinnerPart || lunchPart || "");
    const per = (dinnerPart || lunchPart || "").match(/Per annos:\s*([^\n]+)/i);
    const potato = /perun/i.test(dinnerPart ?? "");
    const saturdayFit = /tortilla|wrap|kotzone|pihvi|grilli/i.test(title) || undefined;
    dishCache.push({
      title,
      proteins: proteinsOf(blob),
      dinnerSides,
      lunchOk: Boolean(lunchPart),
      dinnerOk: Boolean(dinnerPart),
      saturdayFit,
      potatoGrams: potato ? (/300\s*g/i.test(dinnerPart ?? "") && !/250\s*g/i.test(dinnerPart ?? "") ? 300 : 250) : undefined,
      note: per ? per[1].replace(/\s+/g, " ").slice(0, 180) : portions ? `${portions.high} annosta.` : "1 annos.",
    });
  }
  return cache;
}

function recipeSections(text: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = [];
  for (const chunk of text.split(/\n(?=## )/)) {
    const at = chunk.indexOf("## ");
    if (at < 0) continue;
    const body = chunk.slice(at);
    const breakAt = body.indexOf("\n");
    const heading = body.slice(3, breakAt < 0 ? undefined : breakAt).trim();
    const title = heading.replace(/^\d+\.\s*/, "").split(/\s+[—–]\s+/)[0].trim();
    if (!title || title.startsWith("#")) continue;
    sections.push({ title, body: breakAt < 0 ? "" : body.slice(breakAt + 1) });
  }
  return sections;
}

export function libraryDishes(): LibraryDish[] {
  library();
  return dishCache ?? [];
}

function partsFor(title: string): FileParts | undefined {
  const files = library();
  const hint = norm(FILE_HINT[title] ?? title);
  const direct = files.get(hint);
  if (direct) return direct;
  return [...files.entries()].find(([name]) => name.includes(hint) || hint.includes(name))?.[1];
}

function yieldBounds(text: string): { low: number; high: number } | null {
  const range = text.match(/(\d+)\s*[–-]\s*(\d+)\s+(?:isoa\s+)?annos/i);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    return { low, high: Math.max(low, high) };
  }
  const split = text.match(/jaa\s+(?:noin\s+)?(\d+)(?:\s*[–-]\s*(\d+))?\s+annok/i);
  if (split) {
    const low = Number(split[1]);
    const high = split[2] ? Number(split[2]) : low;
    return { low, high: Math.max(low, high) };
  }
  const named = text.match(/(\d+)\s+(?:lounas|päivällis|paivallis)annos/i);
  if (named && Number(named[1]) >= 2) {
    const count = Number(named[1]);
    return { low: count, high: count };
  }
  const single = text.match(/(\d+)\s+(?:isoa\s+)?annos/i) ?? text.match(/(\d+)\s+annoks/i);
  if (single && Number(single[1]) >= 1) {
    const count = Number(single[1]);
    return { low: count, high: count };
  }
  return null;
}

function boundsFor(title: string, dinner: boolean): { low: number; high: number } | null {
  const parts = partsFor(title);
  if (!parts) return null;
  const part = dinner ? parts.dinner : parts.lunch;
  return yieldBounds(part) ?? yieldBounds(bodyOf(blocksOf(part), /annostelu/i));
}

export function recipeYield(title: string, dinner: boolean): number | null {
  return boundsFor(title, dinner)?.low ?? null;
}

export function recipeBatchSize(title: string, dinner: boolean): number | null {
  return boundsFor(title, dinner)?.high ?? null;
}

export function loadRecipeVariant(title: string, dinner: boolean): RecipeVariant | null {
  const parts = partsFor(title);
  if (!parts) return null;
  const lunch = parts.lunch ? variantFrom(parts.lunch, []) : null;
  if (!dinner) return lunch;
  if (!parts.dinner) return lunch;
  const made = variantFrom(parts.dinner, lunch?.ingredients ?? []);
  const sameBase = /sama\s+(pohja|annos|salaatti|kanavuoka|wokki|ruoka|liha|kana)/i.test(parts.dinner);
  if (lunch && lunch.steps.length >= 4 && (sameBase || made.steps.length < 4)) {
    return { ...made, steps: lunch.steps };
  }
  return made;
}

function portionSized(item: Ingredient): boolean {
  const kind = sideKind(item.name);
  if (kind === "potato") return item.grams >= 250 && item.grams <= 360;
  if (kind) return item.grams >= 65 && item.grams <= 75;
  return false;
}

export function selectSide(ingredients: Ingredient[], side?: CarbId): Ingredient[] {
  const tortillas = ingredients.filter((item) => /tortilla/i.test(item.name) && (item.grams >= 40 || item.pieces > 0));
  const plain = ingredients.filter((item) => !/tortilla/i.test(item.name) && !sideKind(item.name));
  if (tortillas.length) return [...plain, tortillas[0]];
  const carbs = ingredients.filter((item) => sideKind(item.name));
  const sized = carbs.filter(portionSized);
  const pool = sized.length ? sized : carbs;
  if (!pool.length) return ingredients;
  if (!side && new Set(pool.map((item) => sideKind(item.name))).size <= 1) {
    return [...ingredients.filter((item) => !sideKind(item.name)), ...pool];
  }
  const chosen = pool.find((item) => sideKind(item.name) === side) ?? pool[0];
  return [...ingredients.filter((item) => !sideKind(item.name)), chosen];
}

export function hasDishCarb(ingredients: Ingredient[]): boolean {
  return ingredients.some((item) => sideKind(item.name));
}
