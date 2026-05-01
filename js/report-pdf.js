(function (global) {
  const INTERNAL_LINE_PATTERN = /^(prompt|hidden prompt|cache|cachekey|cache key|cache metadata|metadata|schema|source|sourceversion|reviewmeta|implementation|debug|internal|supabase|openai)\b\s*[:=-]/i;
  const DEFAULT_REPORT_TITLE = "ConsultAssist journalnotat";

  function sanitizeReportText(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .filter((line) => !INTERNAL_LINE_PATTERN.test(line.trim()))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function buildPdfFilename(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `consultassist-journalnotat-${year}-${month}-${day}.pdf`;
  }

  function splitTextIntoLines(doc, text, maxWidth) {
    return text.split("\n").flatMap((paragraph) => {
      if (!paragraph) return [""];
      return doc.splitTextToSize(paragraph, maxWidth);
    });
  }

  function addWrappedText(doc, text, options) {
    const { margin, maxWidth, pageHeight, lineHeight } = options;
    let y = options.y;

    splitTextIntoLines(doc, text, maxWidth).forEach((line) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }

      doc.text(line, margin, y);
      y += line ? lineHeight : lineHeight * 0.75;
    });

    return y;
  }

  function createReportPdfDocument(options) {
    const { PdfClass, reportText, title = DEFAULT_REPORT_TITLE, createdAt = new Date() } = options;
    const sanitizedText = sanitizeReportText(reportText);
    if (!sanitizedText) {
      throw new Error("Journalnotatet er tomt.");
    }

    const doc = new PdfClass({ unit: "pt", format: "a4" });
    const margin = 54;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setProperties({
      title,
      subject: "Journalnotat eksportert fra ConsultAssist",
      creator: "ConsultAssist"
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, margin, y);
    y += 24;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Eksportert ${createdAt.toLocaleDateString("nb-NO")}`, margin, y);
    y += 28;

    doc.setFontSize(11);
    addWrappedText(doc, sanitizedText, {
      margin,
      maxWidth,
      pageHeight,
      lineHeight: 15,
      y
    });

    return doc;
  }

  function exportReportToPdf(reportText, options = {}) {
    const PdfClass = global.jspdf?.jsPDF || global.jsPDF;
    if (!PdfClass) {
      throw new Error("PDF-biblioteket er ikke lastet inn. Bruk nettleserens utskrift/Lagre som PDF.");
    }

    const createdAt = options.createdAt || new Date();
    const doc = createReportPdfDocument({
      PdfClass,
      reportText,
      title: options.title,
      createdAt
    });

    doc.save(options.filename || buildPdfFilename(createdAt));
  }

  global.ConsultAssistPdf = {
    DEFAULT_REPORT_TITLE,
    buildPdfFilename,
    createReportPdfDocument,
    exportReportToPdf,
    sanitizeReportText
  };

  if (typeof module !== "undefined") {
    module.exports = global.ConsultAssistPdf;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
