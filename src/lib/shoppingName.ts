import type { Category } from "./types";

export type PaprikaKind = "vegetable" | "powder" | "smoked";

export function paprikaKind(name: string): PaprikaKind | null {
  const blob = name.toLocaleLowerCase("fi");
  if (!/paprika/.test(blob) || /herne|maissi/.test(blob)) return null;
  if (/savu/.test(blob)) return "smoked";
  if (/jauhe/.test(blob)) return "powder";
  return "vegetable";
}

export function isWater(name: string): boolean {
  const blob = name.toLocaleLowerCase("fi");
  if (/vesimeloni|vesikastanja/.test(blob)) return false;
  return /(?:^|[^a-zäöå])(vesi|vettä|vetta|veden|veteen|vedessä)(?:$|[^a-zäöå])/.test(blob);
}

export function shoppingName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  const blob = name.toLocaleLowerCase("fi");
  if (!blob) return name;
  const pepper = paprikaKind(name);
  if (pepper === "smoked") return "Savupaprikajauhe";
  if (pepper === "powder") return "Paprikajauhe";
  if (pepper === "vegetable") return "Paprika";
  if (/jauheliha/.test(blob)) return "Jauheliha 5–10 %";
  if (/cashew/.test(blob)) return "Cashewpähkinä";
  if (/^suola(?:a|n)?(?=$|[^a-zäöå])/.test(blob)) return "Suola";
  if (isWater(blob)) return "Vesi";
  if (/^salsa/.test(blob)) return "Salsa";
  if (/tomaattimursk/.test(blob)) return "Tomaattimurska";
  if (/tomaattipyre/.test(blob)) return "Tomaattipyree";
  if (/^sipul/.test(blob) && !/jauhe|kuivattu/.test(blob)) return "Sipuli";
  if (/mustapippur|^pippuria\b|^pippuri\b/.test(blob)) return "Mustapippuri";
  if (/^(öljy|oljy|öljyä|oljyä)(?=$|[^a-zäöå])/.test(blob)) return "Öljy";
  if (/oliiviöljy|oliivioljy/.test(blob)) return "Oliiviöljy";
  return name;
}

export function shoppingCategory(name: string): Category | null {
  if (name === "Paprika" || name === "Sipuli" || name === "Tomaattimurska" || name === "Tomaattipyree" || name === "Salsa") return "produce";
  if (name === "Paprikajauhe" || name === "Savupaprikajauhe" || name === "Suola" || name === "Mustapippuri" || name === "Öljy" || name === "Oliiviöljy" || name === "Cashewpähkinä") return "dry";
  if (name === "Jauheliha 5–10 %") return "meat";
  return null;
}
