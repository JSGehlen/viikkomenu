import assert from "node:assert/strict";
import { dietIssues, saturdayKcal } from "./checks";
import { DEFAULT_FOOD_PREFS } from "./prefs";
import { buildSamplePlan, sampleRaw } from "./sample";

const issues = dietIssues(sampleRaw, DEFAULT_FOOD_PREFS);
assert.deepEqual(issues, [], issues.join("\n"));
assert.equal(saturdayKcal(sampleRaw, DEFAULT_FOOD_PREFS), 2460);

const plan = buildSamplePlan();
const find = (name: string) => plan.shopping.find((item) => item.name === name);

assert.equal(find("Atria Kevyt Nauta-Possu Jauheliha 9,5 %")?.grams, 1650);
assert.equal(find("Jasmiiniriisi")?.grams, 350);
assert.equal(find("Kaurahiutale")?.grams, 280);
assert.equal(find("Banaani")?.pieces, 12);
assert.equal(find("Rasvaton maito")?.ml, 4200);
assert.equal(find("Ísey Skyr Persikka")?.pieces, 6);
assert.equal(find("Kanafilee")?.grams, 300);
assert.equal(find("Oliiviöljy")?.grams, 30);
assert.equal(find("Jasmiiniriisi")?.uses.includes("Su · Päivällinen"), false);

console.log("sample checks ok", plan.shopping.length, "shopping rows");
