import { assemblePlan } from "./assemble";
import { DEFAULT_FOOD_PREFS } from "./prefs";
import type { DayMenu, Ingredient, Meal, RawMenu, WeekPlan } from "./types";

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
    "Paista keskilämmöllä 8–10 minuuttia, kunnes kasvikset pehmenevät.",
    "Maista suola ja anna vetäytyä pari minuuttia ennen tarjoilua.",
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

function day(prep: string, lunchMeal: Meal, dinnerMeal: Meal): DayMenu {
  return { prep, meals: [porridge, lunchMeal, snack, dinnerMeal, evening] };
}

function reheated(meal: Meal): Meal {
  return {
    ...meal,
    blurb: "Annos valmiista satsista. Älä tee uutta ruokaa.",
    steps: ["Lämmitä yksi annos keskilämmöllä noin 4 minuuttia.", "Tarkista että ruoka on kuumaa keskeltä.", "Tarjoile."],
    prep: "Tämä päivä syö aiemmin tehtyä satsia.",
  };
}

const mondayDinner = meal({
  slot: "paivallinen",
  title: "Jauheliha ja jasmiiniriisi",
  blurb: "Päivällinen, jossa jauheliha ja riisi pysyvät erillään.",
  kcal: 560,
  proteinG: 36,
  carbsG: 62,
  fatG: 18,
  ingredients: [
    ing("Atria Kevyt Nauta-Possu Jauheliha 9,5 %", "meat", 150, 0, "raaka"),
    ing("Paprika", "produce", 80, 0, "raaka"),
    ing("Sipuli", "produce", 40, 0, "raaka"),
    ing("Paprikajauhe", "dry", 2),
    ing("Jasmiiniriisi", "dry", 70, 0, "kuivapaino"),
  ],
  steps: [
    "Huuhdo 70 g riisiä ja keitä se vedessä 12 minuuttia. Valuta.",
    "Ruskista jauheliha pannulla keskilämmöllä 4 minuuttia omassa rasvassaan.",
    "Lisää sipuli ja paprika. Paista 6 minuuttia ja mausta paprikajauheella.",
    "Tarjoile riisi erikseen jauhelihan vieressä.",
  ],
});

const tuesdayLunch = meal({
  slot: "lounas",
  title: "Parsakaalikana",
  blurb: "Lounas ilman lisuketta. Öljy on kanalle kuuluva rasva.",
  kcal: 340,
  proteinG: 36,
  carbsG: 6,
  fatG: 16,
  ingredients: [
    ing("Kanafilee", "meat", 150, 0, "raaka"),
    ing("Parsakaali", "produce", 150, 0, "raaka"),
    ing("Oliiviöljy", "dry", 15),
  ],
  steps: [
    "Leikkaa kana suupaloiksi ja parsakaali kukinnoiksi.",
    "Kuumenna öljy pannulla keskilämmöllä.",
    "Paista kanaa 6 minuuttia, lisää parsakaali ja paista vielä 5 minuuttia.",
    "Mausta suolalla ja pippurilla. Älä lisää riisiä tai pastaa.",
  ],
});

const tuesdayDinner = meal({
  slot: "paivallinen",
  title: "Tomaattikana ja pasta",
  blurb: "Eri ruoka kuin lounas. Pasta on päivän ainoa lisuke.",
  kcal: 540,
  proteinG: 40,
  carbsG: 58,
  fatG: 16,
  ingredients: [
    ing("Kanafilee", "meat", 150, 0, "raaka"),
    ing("Tomaatti", "produce", 120, 0, "raaka"),
    ing("Sipuli", "produce", 40, 0, "raaka"),
    ing("Oliiviöljy", "dry", 15),
    ing("Pasta", "dry", 70, 0, "kuivapaino"),
  ],
  steps: [
    "Keitä 70 g pastaa suolavedessä pakkauksen ajan. Valuta.",
    "Kuullota sipuli 15 grammassa öljyä keskilämmöllä 3 minuuttia.",
    "Lisää kana ja paista 7 minuuttia. Lisää tomaatti ja hauduta 5 minuuttia.",
    "Sekoita pasta joukkoon vasta lautasella, ei lounasannokseen.",
  ],
});

const wednesdayLunch = meal({
  slot: "lounas",
  title: "Jauheliha-paprikachili",
  blurb: "Lounas ilman riisiä. Jauhelihan rasva riittää.",
  kcal: 360,
  proteinG: 32,
  carbsG: 8,
  fatG: 18,
  ingredients: [
    ing("Atria Kevyt Nauta-Possu Jauheliha 9,5 %", "meat", 150, 0, "raaka"),
    ing("Paprika", "produce", 80, 0, "raaka"),
    ing("Tomaatti", "produce", 60, 0, "raaka"),
    ing("Sipuli", "produce", 40, 0, "raaka"),
  ],
  steps: [
    "Ruskista jauheliha pannulla keskilämmöllä 4 minuuttia.",
    "Lisää sipuli ja paista 3 minuuttia.",
    "Lisää paprika ja tomaatti. Hauduta kannen alla 10 minuuttia.",
    "Mausta suolalla. Älä lisää lisuketta.",
  ],
});

const wednesdayDinner = meal({
  slot: "paivallinen",
  title: "Jauheliha ja uuniperuna",
  blurb: "Peruna on tämän päivän lisuke, 300 g raakana.",
  kcal: 560,
  proteinG: 34,
  carbsG: 55,
  fatG: 18,
  ingredients: [
    ing("Atria Kevyt Nauta-Possu Jauheliha 9,5 %", "meat", 150, 0, "raaka"),
    ing("Peruna", "produce", 300, 0, "raaka"),
    ing("Salaatti", "produce", 80, 0, "raaka"),
  ],
  steps: [
    "Laita uuni 200 asteeseen. Lohko 300 g perunaa ja paista 25 minuuttia.",
    "Ruskista jauheliha pannulla 6 minuuttia omassa rasvassaan.",
    "Mausta suolalla ja pippurilla.",
    "Tarjoile perunat ja salaatti jauhelihan kanssa.",
  ],
});

const thursdayLunch = meal({
  slot: "lounas",
  title: "Sitruunakana",
  blurb: "Lounas ilman lisuketta. Öljy korvaa rasvan.",
  kcal: 340,
  proteinG: 36,
  carbsG: 4,
  fatG: 16,
  ingredients: [
    ing("Kanafilee", "meat", 150, 0, "raaka"),
    ing("Kesäkurpitsa", "produce", 120, 0, "raaka"),
    ing("Sitruuna", "fruit", 0, 0.5),
    ing("Oliiviöljy", "dry", 15),
  ],
  steps: [
    "Leikkaa kana ja kesäkurpitsa viipaleiksi.",
    "Kuumenna öljy pannulla.",
    "Paista kanaa 6 minuuttia, lisää kesäkurpitsa ja paista 5 minuuttia.",
    "Purista sitruuna päälle. Ei pastaa eikä riisiä.",
  ],
});

const thursdayDinner = meal({
  slot: "paivallinen",
  title: "Kanawokki ja nuudeli",
  blurb: "Nuudeli on tämän päivän ainoa lisuke.",
  kcal: 540,
  proteinG: 38,
  carbsG: 58,
  fatG: 16,
  ingredients: [
    ing("Kanafilee", "meat", 150, 0, "raaka"),
    ing("Paprika", "produce", 80, 0, "raaka"),
    ing("Sipuli", "produce", 40, 0, "raaka"),
    ing("Oliiviöljy", "dry", 15),
    ing("Nuudeli", "dry", 70, 0, "kuivapaino"),
  ],
  steps: [
    "Keitä 70 g nuudelia 4 minuuttia ja valuta.",
    "Kuumenna öljy wokissa tai pannulla keskilämmöllä.",
    "Paista kanaa 5 minuuttia. Lisää paprika ja sipuli, paista 4 minuuttia.",
    "Sekoita nuudeli joukkoon ja tarjoile heti.",
  ],
});

const fridayLunch = meal({
  slot: "lounas",
  title: "Jauheliha ja kesäkurpitsa",
  blurb: "Viikon viimeinen lounas, ilman lisuketta.",
  kcal: 360,
  proteinG: 32,
  carbsG: 7,
  fatG: 18,
  ingredients: [
    ing("Atria Kevyt Nauta-Possu Jauheliha 9,5 %", "meat", 150, 0, "raaka"),
    ing("Kesäkurpitsa", "produce", 150, 0, "raaka"),
    ing("Sipuli", "produce", 40, 0, "raaka"),
  ],
  steps: [
    "Raasta tai suikaloi kesäkurpitsa.",
    "Ruskista jauheliha ja sipuli pannulla 5 minuuttia.",
    "Lisää kesäkurpitsa ja paista 8 minuuttia, kunnes se pehmenee.",
    "Mausta suolalla. Tarjoile ilman riisiä.",
  ],
});

const fridayDinner = meal({
  slot: "paivallinen",
  title: "Curry-jauheliha ja riisi",
  blurb: "Eri jauheliharuoka kuin maanantaina. Lisukkeena riisi.",
  kcal: 560,
  proteinG: 36,
  carbsG: 60,
  fatG: 18,
  ingredients: [
    ing("Atria Kevyt Nauta-Possu Jauheliha 9,5 %", "meat", 150, 0, "raaka"),
    ing("Tomaatti", "produce", 100, 0, "raaka"),
    ing("Sipuli", "produce", 40, 0, "raaka"),
    ing("Jasmiiniriisi", "dry", 70, 0, "kuivapaino"),
  ],
  steps: [
    "Keitä 70 g riisiä vedessä 12 minuuttia.",
    "Kuullota sipuli jauhelihan omassa rasvassa 3 minuuttia.",
    "Lisää jauheliha ja ruskista 5 minuuttia. Lisää tomaatti ja hauduta 8 minuuttia.",
    "Tarjoile riisi kastikkeen vieressä.",
  ],
});

const weekdays: DayMenu[] = [
  day("Tee jauhelihalounas ja riisipäivällinen satsina ma–ke. Riisi vain päivällisannoksiin.", lunch, mondayDinner),
  day("Lämmitä maanantain lounas- ja päivällisannos.", reheated(lunch), reheated(mondayDinner)),
  day("Lämmitä maanantain lounas- ja päivällisannos.", reheated(lunch), reheated(mondayDinner)),
  day("Tee kanalounas ja pastapäivällinen satsina to–pe. Pasta vain päivällisannoksiin.", tuesdayLunch, tuesdayDinner),
  day("Lämmitä torstain lounas- ja päivällisannos.", reheated(tuesdayLunch), reheated(tuesdayDinner)),
];

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
    "Ruskista jauheliha pannulla keskilämmöllä 6 minuuttia ja mausta suolalla.",
    "Lämmitä tortillat kuivalla pannulla noin 30 sekuntia puoleltaan.",
    "Pilko tomaatti ja salaatti.",
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
    "Laita uuni 200 asteeseen.",
    "Lohko perunat ja paista niitä 25 minuuttia.",
    "Lisää lohi vuokaan, mausta suolalla ja sitruunalla, ja paista 12–15 minuuttia.",
    "Tarjoile salaatin kanssa. Loholle ei lisätä öljyä.",
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
    "Leikkaa kana suupaloiksi ja kasvikset pienemmiksi.",
    "Kuumenna 15 g oliiviöljyä pannulla keskilämmöllä.",
    "Paista kanaa 6 minuuttia, lisää kasvikset ja paista 6 minuuttia.",
    "Mausta suolalla ja pippurilla. Älä lisää lisuketta.",
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
    "Tee sama kana-kasvispaistos kuin lounaalla, jos sitä on jäljellä.",
    "Lämmitä annos pannulla keskilämmöllä 4 minuuttia.",
    "Tarkista että kana on kuumaa keskeltä.",
    "Tarjoile ilman riisiä, pastaa, nuudelia tai perunaa.",
  ],
  prep: "Sunnuntain päivällisellä ei ole erillistä hiilihydraattilisuketta.",
});

export const sampleRaw: RawMenu = {
  title: "Jauhelihaviikko",
  summary:
    "Arkilounas ja päivällinen tehdään satsina ja syödään useana päivänä. Lauantai on vapaampi, sunnuntain päivällinen jää ilman lisuketta.",
  weekdays,
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
