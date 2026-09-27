import { assemblePlan } from "./assemble";
import { DEFAULT_FOOD_PREFS } from "./prefs";
import type { Ingredient, Meal, RawMenu, WeekPlan } from "./types";

function ing(
  name: string,
  category: Ingredient["category"],
  grams = 0,
  pieces = 0,
  detail = "",
): Ingredient {
  return { name, category, grams, pieces, ml: 0, detail };
}

function meal(partial: Omit<Meal, "prep"> & { prep?: string }): Meal {
  return { prep: "", ...partial };
}

const porridge = meal({
  slot: "aamiainen",
  title: "Mustikka-kaurapuuro",
  blurb: "Nykyinen aamupala: kaura, hera, marjat ja yksi rasva.",
  kcal: 420,
  proteinG: 32,
  carbsG: 42,
  fatG: 14,
  ingredients: [
    ing("Kaurahiutale", "dry", 40, 0, "kuivapaino"),
    ing("Hera", "dairy", 30),
    ing("Mustikka", "frozen", 80),
    ing("Maapähkinävoi", "dry", 20),
  ],
  steps: [
    "Kiehauta vesi ja sekoita joukkoon kaurahiutaleet. Keitä pari minuuttia.",
    "Nosta levyltä ja sekoita hera joukkoon.",
    "Lisää mustikat ja maapähkinävoi.",
  ],
});

const lunch = meal({
  slot: "lounas",
  title: "Jauheliha-kasvispaistos",
  blurb: "Arkilounas ilman riisiä. Jauhelihan rasva riittää, erillistä öljyä ei lisätä.",
  kcal: 360,
  proteinG: 32,
  carbsG: 8,
  fatG: 18,
  ingredients: [
    ing("Atria Kevyt Nauta-Possu Jauheliha 9,5 %", "meat", 150, 0, "raaka"),
    ing("Paprika", "produce", 80, 0, "raaka"),
    ing("Kesäkurpitsa", "produce", 70, 0, "raaka"),
    ing("Sipuli", "produce", 40, 0, "raaka"),
    ing("Paprikajauhe", "dry", 2),
  ],
  steps: [
    "Ruskista jauheliha pannulla omassa rasvassaan.",
    "Lisää sipuli, paprika ja kesäkurpitsa. Mausta paprikajauheella.",
    "Paista, kunnes kasvikset pehmenevät. Yksi annos on yksi lounas.",
  ],
  prep: "Tee pohja kerralla kymmeneen annokseen. Älä lisää riisiä tähän satsiin.",
});

const snack = meal({
  slot: "valipala",
  title: "Persikkaskyr ja banaani",
  blurb: "Välipala ilman pähkinöitä.",
  kcal: 230,
  proteinG: 18,
  carbsG: 28,
  fatG: 1,
  ingredients: [ing("Ísey Skyr Persikka", "dairy", 0, 1, "170 g purkki"), ing("Banaani", "fruit", 0, 1)],
  steps: ["Avaa skyr ja syö banaanin kanssa."],
});

const dinner = meal({
  slot: "paivallinen",
  title: "Jauheliha-kasvispaistos ja riisi",
  blurb: "Sama pohja kuin lounaalla, lisukkeena 70 g kuivaa riisiä.",
  kcal: 560,
  proteinG: 36,
  carbsG: 62,
  fatG: 18,
  ingredients: [
    ing("Atria Kevyt Nauta-Possu Jauheliha 9,5 %", "meat", 150, 0, "raaka"),
    ing("Paprika", "produce", 80, 0, "raaka"),
    ing("Kesäkurpitsa", "produce", 70, 0, "raaka"),
    ing("Sipuli", "produce", 40, 0, "raaka"),
    ing("Paprikajauhe", "dry", 2),
    ing("Jasmiiniriisi", "dry", 70, 0, "kuivapaino"),
  ],
  steps: [
    "Keitä riisi vedessä. Käytä 70 g kuivaa riisiä yhtä päivällisannosta kohti.",
    "Lämmitä yksi jauheliha-kasvisannos.",
    "Tarjoile riisi erikseen.",
  ],
  prep: "Riisi kypsennetään erikseen eikä sitä sekoiteta lounasannoksiin.",
});

const evening = meal({
  slot: "iltapala",
  title: "Raejuusto, banaani ja cashew",
  blurb: "Nykyinen iltapala: 200 g raejuustoa, hedelmä ja yksi pähkinä.",
  kcal: 340,
  proteinG: 28,
  carbsG: 32,
  fatG: 12,
  ingredients: [
    ing("Rasvaton raejuusto", "dairy", 200),
    ing("Banaani", "fruit", 0, 1),
    ing("Cashewpähkinä", "dry", 20),
  ],
  steps: ["Laita raejuusto kulhoon ja lisää banaani sekä cashewpähkinät."],
});

const saturdayPorridge = meal({
  ...porridge,
  slot: "jousto",
  blurb: "Lauantain aamu voi olla tuttu puuro. Se lasketaan päivän kaloreihin.",
});

const tortillas = meal({
  slot: "jousto",
  title: "Jauhelihatortillat",
  blurb: "Lauantain vapaa ruoka. Juusto ja crème fraîche lasketaan mukaan.",
  kcal: 800,
  proteinG: 42,
  carbsG: 62,
  fatG: 36,
  ingredients: [
    ing("Vehnätortilla", "bakery", 0, 2),
    ing("Atria Kevyt Nauta-Possu Jauheliha 9,5 %", "meat", 150, 0, "raaka"),
    ing("Juusto", "dairy", 40),
    ing("Crème fraîche", "dairy", 30),
    ing("Tomaatti", "produce", 80, 0, "raaka"),
    ing("Salaatti", "produce", 40, 0, "raaka"),
  ],
  steps: [
    "Ruskista jauheliha ja mausta.",
    "Lämmitä tortillat.",
    "Täytä tortillat jauhelihalla, tomaatilla, salaatilla, juustolla ja crème fraîchella.",
  ],
});

const salmon = meal({
  slot: "jousto",
  title: "Uunilohi ja peruna",
  blurb: "Lauantaina peruna on sallittu. Loholle ei lisätä erillistä rasvaa.",
  kcal: 600,
  proteinG: 40,
  carbsG: 48,
  fatG: 24,
  ingredients: [
    ing("Lohi", "meat", 150, 0, "raaka"),
    ing("Peruna", "produce", 250, 0, "raaka"),
    ing("Salaatti", "produce", 80, 0, "raaka"),
    ing("Sitruuna", "fruit", 0, 0.5),
  ],
  steps: [
    "Laita perunat uuniin tai keitä ne kypsiksi.",
    "Paista tai kypsennä lohi uunissa suolalla ja sitruunalla.",
    "Tarjoile salaatin kanssa.",
  ],
});

const sundayLunch = meal({
  slot: "lounas",
  title: "Kana ja parsakaali",
  blurb: "Sunnuntain lounas ilman lisuketta. Öljy on kanalle kuuluva rasva.",
  kcal: 340,
  proteinG: 36,
  carbsG: 6,
  fatG: 16,
  ingredients: [
    ing("Kanafilee", "meat", 150, 0, "raaka"),
    ing("Parsakaali", "produce", 120, 0, "raaka"),
    ing("Paprika", "produce", 50, 0, "raaka"),
    ing("Oliiviöljy", "dry", 15),
  ],
  steps: [
    "Leikkaa kana ja kasvikset.",
    "Paista ne pannulla 15 grammassa oliiviöljyä.",
    "Mausta suolalla ja pippurilla.",
  ],
});

const sundayDinner = meal({
  slot: "paivallinen",
  title: "Kana ja parsakaali ilman lisuketta",
  blurb: "Sunnuntain päivällinen on muuten sama, mutta ilman riisiä, pastaa tai perunaa.",
  kcal: 340,
  proteinG: 36,
  carbsG: 6,
  fatG: 16,
  ingredients: [
    ing("Kanafilee", "meat", 150, 0, "raaka"),
    ing("Parsakaali", "produce", 120, 0, "raaka"),
    ing("Paprika", "produce", 50, 0, "raaka"),
    ing("Oliiviöljy", "dry", 15),
  ],
  steps: [
    "Käytä samaa kana-kasvispaistosta kuin lounaalla.",
    "Älä lisää riisiä, pastaa, nuudelia tai perunaa.",
  ],
  prep: "Sunnuntain päivällisellä ei ole erillistä hiilihydraattilisuketta.",
});

export const sampleRaw: RawMenu = {
  title: "Jauhelihaviikko",
  summary: "Arkena sama jauhelihapohja ja riisi vain päivällisellä. Lauantai on vapaampi, sunnuntain päivällinen jää ilman lisuketta.",
  weekdayPrep:
    "Ruskista jauheliha ja kasvikset kerralla kymmeneen annokseen. Keitä riisi vain viiteen päivällisannokseen, 70 g kuivaa riisiä per annos.",
  weekday: [porridge, lunch, snack, dinner, evening],
  saturdayNote:
    "Lauantain arvio sisältää puuron, tortillat, lohen, herkut ja noin 200 kcal rasvatonta maitoa. Herkkujen energia kannattaa tarkistaa pakkauksesta.",
  saturdayMeals: [saturdayPorridge, tortillas, salmon],
  saturdayTreats: [
    { name: "Fazer Minttu Crisp 37 g", grams: 0, pieces: 1, ml: 0, kcal: 180, detail: "tarkista pakkauksesta" },
    { name: "Remix Duo Mini", grams: 0, pieces: 1, ml: 0, kcal: 150, detail: "tarkista pakkauksesta" },
    { name: "Halva Vanhat Autot 15 g", grams: 0, pieces: 1, ml: 0, kcal: 110, detail: "tarkista pakkauksesta" },
  ],
  sundayPrep: "Kana ja kasvikset voi tehdä kerralla lounaaksi ja päivälliseksi. Lisuketta ei tule päivälliselle.",
  sunday: [
    { ...porridge, blurb: "Sama puuro kuin arkena." },
    sundayLunch,
    { ...snack },
    sundayDinner,
    { ...evening },
  ],
};

export function buildSamplePlan(): WeekPlan {
  return assemblePlan(sampleRaw, DEFAULT_FOOD_PREFS, {
    sample: true,
    warnings: [],
  });
}
