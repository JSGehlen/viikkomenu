import { libraryDishes } from "./recipeBody";
import type { CarbId, FoodPrefs } from "./types";

export type ProteinId = FoodPrefs["proteins"][number];

/** Named dish read from the shopping-list recipe files. */
export type RecipeExample = {
  title: string;
  proteins: ProteinId[];
  dinnerSides: CarbId[];
  lunchOk: boolean;
  dinnerOk: boolean;
  saturdayFit?: boolean;
  potatoGrams?: 250 | 300;
  note: string;
};

export const RECIPE_EXAMPLES: RecipeExample[] = libraryDishes();
export const RECIPE_EXAMPLE_COUNT = RECIPE_EXAMPLES.length;

export function recipeExamplesForPrefs(prefs: FoodPrefs): RecipeExample[] {
  const proteins = new Set(prefs.proteins);
  const carbs = new Set(prefs.carbs);
  return RECIPE_EXAMPLES.filter((item) => {
    if (!item.proteins.some((id) => proteins.has(id))) return false;
    if (item.saturdayFit && !item.lunchOk && !item.dinnerOk) return true;
    if (item.lunchOk) return true;
    if (item.dinnerOk && (item.dinnerSides.length === 0 || item.dinnerSides.some((id) => carbs.has(id)))) {
      return true;
    }
    return false;
  });
}

/** Compact library block for the user prompt. Names only + short notes — no cookbook prose. */
export function buildRecipeLibraryPrompt(prefs: FoodPrefs): string {
  const items = recipeExamplesForPrefs(prefs);
  const lunch = items.filter((item) => item.lunchOk);
  const dinner = items.filter((item) => item.dinnerOk);
  const saturday = items.filter((item) => item.saturdayFit);

  const line = (item: RecipeExample) => `- ${item.title}: ${item.note}`;

  const lines = [
    `Reseptikirjasto (${RECIPE_EXAMPLE_COUNT} nimettyä esimerkkiä tiedostoista lunch-with-shoppinglist.md ja dinner-with-shoppinglist.md; alla suodatetut valintoihisi):`,
    "Käytä näitä ENSISIJAISESTI lounaisiin ja päivällisiin. Yksi ruoka on satsi, joka jaetaan usealle päivälle. Älä tee joka arkipäivälle eri ruokaa.",
    "Säädä aina tämän suunnitelman grammoihin, yhden henkilön annoksena. Kirjoita ainekset ja vähintään neljä valmistusvaihetta itse sinä päivänä, kun satsi tehdään — älä liitä vanhaa reseptitekstiä sellaisenaan.",
    "Lounasversio: 150 g lihaa tai kalaa, 100–200 g kasviksia, ei riisiä, pastaa, nuudelia, perunaa eikä tortillaa. Jauhelihalle ja lohelle ei lisätä rasvaa. Kanalle tai kalkkunalle yksi rasva: 15 g öljyä, 30 g cashewpähkinöitä tai 75 g avokadoa. Päivällinen ma–pe: tasan yksi lisuke, 70 g kuivaa riisiä tai pastaa tai 250 g raakaa perunaa. Sunnuntain päivällinen ilman lisuketta.",
    "",
    "Lounaaseen sopivat:",
    ...(lunch.length ? lunch.map(line) : ["- (ei suoraan sopivia esimerkkejä valituilla proteiineilla — keksi omat lounaat säännöillä)"]),
    "",
    "Päivälliseen sopivat:",
    ...(dinner.length ? dinner.map(line) : ["- (ei suoraan sopivia — keksi omat päivälliset)"]),
  ];

  if (saturday.length) {
    lines.push("", "Lauantaille sopivat myös:", ...saturday.map(line));
  }

  lines.push(
    "",
    "Keksi lisäksi OMIA aterioita (samat grammasäännöt), kun:",
    "- kirjastosta ei löydy sopivaa satsia valituille proteiineille tai lisukkeille,",
    "- käyttäjän notes/välttämisohjeet tai avoidRepeat sitä vaativat.",
    "Oma ateriakin tehdään satsina usealle päivälle. Älä lukitse viikkoa pelkkään esimerkkilistaan, äläkä täytä joka päivää uudella ruoalla.",
  );

  return lines.join("\n");
}
