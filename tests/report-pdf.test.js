const assert = require("node:assert/strict");
const {
  DEFAULT_REPORT_TITLE,
  buildPdfFilename,
  createReportPdfDocument,
  exportReportToPdf,
  sanitizeReportText
} = require("../js/report-pdf.js");

const reportWithMetadata = `Journalnotat - Svimmelhet

Problemstilling:
Pasienten beskriver økende svimmelhet, kvalme og nærliggende låsning i nakke.

Opplysninger og funn:
- Debut og forløp: Akutt. Startet i går.
- Ørestatus: Hørsel upåfallende, ingen øresmerter eller øresus.
Prompt: skjult systemtekst som ikke skal eksporteres
cacheKey: consultassist-sheet:v1:svimmelhet
sourceVersion: openai:gpt-5.2
reviewMeta: intern metadata

Plan:
- Oppfølging ved forverring.`;

const sanitized = sanitizeReportText(reportWithMetadata);

assert.match(sanitized, /Journalnotat - Svimmelhet/);
assert.match(sanitized, /økende svimmelhet, kvalme og nærliggende låsning/);
assert.match(sanitized, /Hørsel upåfallende/);
assert.match(sanitized, /øresmerter eller øresus/);
assert.match(sanitized, /Oppfølging ved forverring/);
assert.doesNotMatch(sanitized, /Prompt:/i);
assert.doesNotMatch(sanitized, /cacheKey:/i);
assert.doesNotMatch(sanitized, /sourceVersion:/i);
assert.doesNotMatch(sanitized, /reviewMeta:/i);

assert.equal(buildPdfFilename(new Date("2026-05-01T12:00:00Z")), "consultassist-journalnotat-2026-05-01.pdf");
assert.equal(DEFAULT_REPORT_TITLE, "ConsultAssist journalnotat");

const fakePdf = {
  calls: [],
  internal: {
    pageSize: {
      getWidth() {
        return 595;
      },
      getHeight() {
        return 842;
      }
    }
  },
  splitTextToSize(text) {
    return text.split("\n");
  },
  setProperties(properties) {
    this.calls.push(["setProperties", properties]);
  },
  setFont(font, style) {
    this.calls.push(["setFont", font, style]);
  },
  setFontSize(size) {
    this.calls.push(["setFontSize", size]);
  },
  text(line, x, y) {
    this.calls.push(["text", line, x, y]);
  },
  addPage() {
    this.calls.push(["addPage"]);
  },
  save(filename) {
    this.calls.push(["save", filename]);
  }
};

const pdf = createReportPdfDocument({
  PdfClass: function FakePdfConstructor(options) {
    fakePdf.calls.push(["constructor", options]);
    return fakePdf;
  },
  reportText: sanitized,
  createdAt: new Date("2026-05-01T12:00:00Z")
});

assert.equal(pdf, fakePdf);
assert.deepEqual(fakePdf.calls[0], ["constructor", { unit: "pt", format: "a4" }]);
assert.ok(fakePdf.calls.some((call) => call[0] === "text" && call[1].includes("ConsultAssist journalnotat")));
assert.ok(fakePdf.calls.some((call) => call[0] === "text" && call[1].includes("æ")));
assert.ok(fakePdf.calls.some((call) => call[0] === "text" && call[1].includes("ø")));
assert.ok(fakePdf.calls.some((call) => call[0] === "text" && call[1].includes("å")));

globalThis.jspdf = {
  jsPDF: function FakePdfConstructor(options) {
    fakePdf.calls.push(["constructor", options]);
    return fakePdf;
  }
};

exportReportToPdf(sanitized, { createdAt: new Date("2026-05-01T12:00:00Z") });
assert.ok(fakePdf.calls.some((call) => call[0] === "save" && call[1] === "consultassist-journalnotat-2026-05-01.pdf"));

console.log("report-pdf tests passed");
