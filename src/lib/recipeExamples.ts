import type { CarbId, FoodPrefs } from "./types";

export type ProteinId = FoodPrefs["proteins"][number];

/** Named dish from receipe-examples/, adapted to this app's gram rules. No verbatim cookbook steps. */
export type RecipeExample = {
  title: string;
  proteins: ProteinId[];
  /** Preferred dinner sides when this dish is used Mon–Fri. Empty = any selected side works. */
  dinnerSides: CarbId[];
  lunchOk: boolean;
  dinnerOk: boolean;
  /** Prefer Saturday when tortilla/wrap-heavy or whole-cut beef. */
  saturdayFit?: boolean;
  /** Keep 250 g potato when the familiar recipe uses that, do not silently bump to 300. */
  potatoGrams?: 250 | 300;
  /** Short adaptation hint for the model (grams / structure only). */
  note: string;
};

/**
 * Library sourced from /receipe-examples (each file has lunch + dinner versions).
 * Count: 26 unique dishes × lunch/dinner variants in source files.
 */
export const RECIPE_EXAMPLES: RecipeExample[] = [
  {
    title: "Italianpata",
    proteins: ["beef"],
    dinnerSides: ["pasta"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g Atria-jauhelihaa/annos. Lounas ilman pastaa. Päivällinen: 70 g kuivaa pastaa.",
  },
  {
    title: "Jauheliha-makaroni",
    proteins: ["beef"],
    dinnerSides: ["pasta"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g jauhelihaa. Lounas: vain kasvikset, ei makaronia. Päivällinen: 70 g kuivaa makaronia.",
  },
  {
    title: "Jauheliha-perunavuoka",
    proteins: ["beef"],
    dinnerSides: ["potato"],
    lunchOk: true,
    dinnerOk: true,
    potatoGrams: 250,
    note: "150 g jauhelihaa. Lounas ilman perunaa, lisää kasviksia. Päivällinen: 250–300 g raakaa perunaa (pidä 250 g jos resepti niin).",
  },
  {
    title: "Szechuan-kana",
    proteins: ["chicken"],
    dinnerSides: ["noodles"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g kanaa + kasvikset. Lounas ilman nuudelia; rasva kastikkeesta tai 15 g öljyä. Päivällinen: 70 g kuivia nuudeleita.",
  },
  {
    title: "Kanaa ja riisiä uunissa",
    proteins: ["chicken"],
    dinnerSides: ["rice"],
    lunchOk: false,
    dinnerOk: true,
    note: "Vain päivällinen: 150 g kanaa + 70 g kuivaa jasmiiniriisiä + kasvikset. Kerma/liemi voi korvata erillisen rasvan.",
  },
  {
    title: "Kanasalaatti",
    proteins: ["chicken"],
    dinnerSides: ["rice", "pasta"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g kanaa + 100–200 g kasviksia. Yksi rasva (öljy/cashew/avokado tai vinaigrette). Lounas ilman lisuketta; päivällisellä yksi lisuke.",
  },
  {
    title: "Kanavuoka",
    proteins: ["chicken"],
    dinnerSides: ["pasta"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g kanaa. Lounas: pasta pois, kasvikset + kerma. Päivällinen: 70 g kuivaa pastaa. Kerma korvaa erillisen öljyn.",
  },
  {
    title: "Kanawokki",
    proteins: ["chicken"],
    dinnerSides: ["rice", "noodles"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g kanaa + kasvikset. Cashew ~30 g/annos TAI öljy 15 g. Lounas ilman riisiä/nuudelia. Päivällinen: 70 g kuivaa riisiä tai nuudelia.",
  },
  {
    title: "Kanawrap",
    proteins: ["chicken"],
    dinnerSides: ["rice"],
    lunchOk: true,
    dinnerOk: true,
    saturdayFit: true,
    note: "Lounas: kana + kasvikset + dippi kulhossa, ei tortillaa. Päivällinen: sama täyte + 70 g riisiä (ei tortillaa arkisin). Tortilla sopii lauantaille.",
  },
  {
    title: "Kokoliha grillissä",
    proteins: ["beef"],
    dinnerSides: ["rice", "pasta", "potato"],
    lunchOk: true,
    dinnerOk: true,
    saturdayFit: true,
    note: "Arkena suosi jauhelihaversiota (150 g Atria). Kokoliha vain jos notes pyytää tai lauantaina. Ei erillistä rasva-annosta jauhelihan kanssa.",
  },
  {
    title: "Kotzone",
    proteins: ["chicken"],
    dinnerSides: ["rice", "pasta"],
    lunchOk: true,
    dinnerOk: true,
    saturdayFit: true,
    note: "Lounas: kana + tomaatti + salaatti ilman tortillaa. Päivällinen: täyte + yksi lisuke. Tortilla lauantaille.",
  },
  {
    title: "Kreikkalainen kana-kasvispelti",
    proteins: ["chicken"],
    dinnerSides: ["rice", "pasta"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g kanaa + kasvikset. Feta/öljy yhdessä eränä korvaa erillisen rasvan. Lounas ilman lisuketta; päivällinen 70 g riisiä tai pastaa.",
  },
  {
    title: "Lihapullat tomaattikastikkeessa",
    proteins: ["beef"],
    dinnerSides: ["pasta", "rice", "potato"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g jauhelihaa pulissa. Lounas ilman pastaa/perunaa. Päivällinen: yksi lisuke 70 g kuivana tai ~300 g perunaa.",
  },
  {
    title: "Lihapullavuoka",
    proteins: ["beef"],
    dinnerSides: ["pasta"],
    lunchOk: false,
    dinnerOk: true,
    note: "Vain päivällinen: 150 g jauhelihapullia + 70 g kuivaa pastaa + kasvikset. Kerma ok, ei erillistä öljyä.",
  },
  {
    title: "Lohisalaatti",
    proteins: ["salmon"],
    dinnerSides: ["rice", "pasta", "potato"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g lohta + kasvikset. Ei erillistä rasvaa. Lounas ilman lisuketta; päivällisellä yksi lisuke.",
  },
  {
    title: "Makaronilaatikko",
    proteins: ["beef"],
    dinnerSides: ["pasta"],
    lunchOk: false,
    dinnerOk: true,
    note: "Vain päivällinen: jauheliha 150 g/annos + 70 g kuivaa makaronia. Älä tarjoa lounaaksi.",
  },
  {
    title: "Nakkikastike",
    proteins: ["turkey"],
    dinnerSides: ["potato"],
    lunchOk: true,
    dinnerOk: true,
    potatoGrams: 300,
    note: "150 g 5 % kalkkunanakkia. Lounas ilman perunaa + kasvikset. Päivällinen: ~300 g raakaa perunaa. Rasva kastikkeesta.",
  },
  {
    title: "Nakkikeitto",
    proteins: ["turkey"],
    dinnerSides: ["potato"],
    lunchOk: true,
    dinnerOk: true,
    potatoGrams: 300,
    note: "150 g kalkkunanakkia. Lounas: kasviskeitto ilman isoa perunaosuutta. Päivällinen: ~300 g peruna-kasvisseosta.",
  },
  {
    title: "Pihvi ja grillikasvikset",
    proteins: ["beef"],
    dinnerSides: ["rice", "pasta", "potato"],
    lunchOk: true,
    dinnerOk: true,
    saturdayFit: true,
    note: "Arkena jauheliha- tai jauhelihapihvi 150 g Atriaa. Kokopihvi lauantaille tai jos notes pyytää. Lisuke vain päivällisellä.",
  },
  {
    title: "Pyttipannu",
    proteins: ["turkey"],
    dinnerSides: ["potato"],
    lunchOk: true,
    dinnerOk: true,
    potatoGrams: 250,
    note: "150 g kalkkunanakkia. Lounas: nakit + kasvikset, peruna pois. Päivällinen: 250–300 g peruna-sipulia.",
  },
  {
    title: "Tacosalaatti",
    proteins: ["beef"],
    dinnerSides: ["rice"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g jauhelihaa + kasvikset. Lounas: ei tortillaa; tacolastut max ~15 g tai pois. Päivällinen: 70 g riisiä (ei tortillaa arkisin).",
  },
  {
    title: "Lohikastike ja kesäkurpitsanuudelit",
    proteins: ["salmon"],
    dinnerSides: ["pasta", "rice"],
    lunchOk: true,
    dinnerOk: true,
    note: "Esimerkki oli tonnikalaa: käytä 150 g lohta. Lounas zoodleilla. Päivällinen: 70 g kuivaa pastaa tai riisiä. Ei erillistä rasvaa.",
  },
  {
    title: "Lohikulho (wrap ilman tortillaa)",
    proteins: ["salmon"],
    dinnerSides: ["rice"],
    lunchOk: true,
    dinnerOk: true,
    saturdayFit: true,
    note: "Tonnikalawrap-esimerkki muokattuna loheksi. Lounas/päivällinen kulhona ilman tortillaa; päivällisellä 70 g riisiä. Tortilla lauantaille.",
  },
  {
    title: "Tortillat",
    proteins: ["chicken", "beef"],
    dinnerSides: ["rice"],
    lunchOk: false,
    dinnerOk: false,
    saturdayFit: true,
    note: "Lähinnä lauantain joustoateria. Arkisin: sama täyte kulhossa (lounas) tai + 70 g riisiä (päivällinen), ei tortillaa.",
  },
  {
    title: "Uunikasvikset ja proteiini",
    proteins: ["chicken", "beef", "turkey", "salmon"],
    dinnerSides: ["potato", "rice", "pasta"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g valittua proteiinia + 100–200 g uunikasviksia. Rasvasääntö proteiinin mukaan. Päivällisellä yksi lisuke.",
  },
  {
    title: "Uunilohi",
    proteins: ["salmon"],
    dinnerSides: ["rice", "pasta", "potato"],
    lunchOk: true,
    dinnerOk: true,
    note: "150 g lohta + kasvikset. Ei erillistä rasvaa. Lounas ilman lisuketta; päivällisellä yksi lisuke.",
  },
];

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
    `Reseptikirjasto (${RECIPE_EXAMPLE_COUNT} nimettyä esimerkkiä kansiosta receipe-examples; alla suodatetut valintoihisi):`,
    "Käytä näitä ENSISIJAISESTI lounaisiin ja päivällisiin. Yksi ruoka on satsi, joka jaetaan usealle päivälle. Älä tee joka arkipäivälle eri ruokaa.",
    "Säädä aina tämän suunnitelman grammoihin, yhden henkilön annoksena. Kirjoita ainekset ja vähintään neljä valmistusvaihetta itse sinä päivänä, kun satsi tehdään — älä liitä vanhaa reseptitekstiä sellaisenaan.",
    "Lounasversio: ei riisiä, pastaa, nuudelia, perunaa eikä tortillaa. Päivällinen ma–pe: tasan yksi lisuke. Sunnuntain päivällinen ilman lisuketta.",
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
