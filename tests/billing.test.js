const assert = require("node:assert/strict");
const tariffData = require("../normaltariffen_2025_2026.json");
const billing = require("../billing.js");

function codes(inputCodes) {
  return new Set(inputCodes);
}

function validate(inputCodes) {
  return billing.validateCombinations(billing.fetchTakster(codes(inputCodes), tariffData)).map((takst) => takst.code);
}

function assertConflict(inputCodes) {
  const result = validate(inputCodes);
  assert.equal(result.length, 1, `${inputCodes.join(" + ")} should remove one conflict`);
  assert.equal(inputCodes.some((code) => result.includes(code)), true);
}

assertConflict(["707", "129g"]);
assertConflict(["708a", "121a"]);

assert.deepEqual(validate(["2as", "705k"]), ["2as"]);
assert.deepEqual(validate(["2cd", "110"]), ["110"]);
assert.deepEqual(validate(["2ad", "707", "705k"]).sort(), ["2ad", "705k", "707"].sort());

const suggestions = billing.resolveBillingSuggestions({
  tariffData,
  sheetAnswers: {
    ekg: { questionLabel: "EKG ved indikasjon", answerValue: "Normal" },
    notDone: { questionLabel: "Ortostatisk blodtrykk", answerValue: "Ikke utført" }
  }
});

assert.equal(suggestions.some((takst) => takst.code === "707"), true);
assert.equal(suggestions.some((takst) => takst.code === "2ad"), true);

const block = billing.formatTakstBlock(suggestions.filter((takst) => ["2ad", "707"].includes(takst.code)));
assert.match(block, /--- Takster ---/);
assert.match(block, /2ad/);
assert.match(block, /707/);

console.log("billing tests passed");
