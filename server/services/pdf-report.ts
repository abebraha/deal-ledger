import PDFDocument from "pdfkit";

interface PDFReportOptions {
  title: string;
  type: string;
  content: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  createdAt: string;
}

const COLORS = {
  primary: "#1a1a2e",
  accent: "#2563eb",
  accentWeekly: "#2563eb",
  accentBiweekly: "#7c3aed",
  accentCustom: "#d97706",
  heading1: "#1a1a2e",
  heading2: "#1e293b",
  heading3: "#334155",
  heading4: "#475569",
  body: "#374151",
  muted: "#6b7280",
  light: "#9ca3af",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  bulletPrimary: "#2563eb",
  bulletSecondary: "#94a3b8",
  tableBg: "#f8fafc",
  white: "#ffffff",
};

function getAccentColor(type: string): string {
  if (type === "weekly") return COLORS.accentWeekly;
  if (type === "biweekly") return COLORS.accentBiweekly;
  return COLORS.accentCustom;
}

function getReportSubtitle(type: string): string {
  if (type === "weekly") return "Weekly Pipeline Update";
  if (type === "biweekly") return "CEO Biweekly Scorecard";
  return "Custom Report";
}

export function generateReportPDF(options: PDFReportOptions, outputStream: NodeJS.WritableStream): void {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 50, bottom: 60, left: 55, right: 55 },
    bufferPages: true,
    info: {
      Title: options.title,
      Author: "DealFlow",
      Subject: getReportSubtitle(options.type),
    },
  });

  doc.pipe(outputStream);

  const LEFT = 55;
  const RIGHT = doc.page.width - 55;
  const pageWidth = RIGHT - LEFT;
  const accent = getAccentColor(options.type);

  renderHeader(doc, options, accent, LEFT, RIGHT, pageWidth);
  renderMarkdownContent(doc, options.content, pageWidth, LEFT, RIGHT, accent);

  const range = doc.bufferedPageRange();
  const pageCount = range.count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 45;
    doc.save();
    doc.moveTo(LEFT, footerY).lineTo(RIGHT, footerY)
      .strokeColor(COLORS.borderLight).lineWidth(0.5).stroke();
    doc.restore();
    doc.save();
    doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.light);
    doc.text("DealFlow", LEFT, footerY + 8, { lineBreak: false, width: 100 });
    doc.text(`Page ${i + 1} of ${pageCount}`, RIGHT - 100, footerY + 8, { lineBreak: false, width: 100, align: "right" });
    doc.restore();
  }

  doc.flushPages();
  doc.end();
}

function renderHeader(
  doc: PDFKit.PDFDocument,
  options: PDFReportOptions,
  accent: string,
  LEFT: number,
  RIGHT: number,
  pageWidth: number,
) {
  doc.rect(0, 0, doc.page.width, 4).fill(accent);

  doc.y = 28;

  doc.font("Helvetica-Bold").fontSize(24).fillColor(COLORS.primary)
    .text(options.title, LEFT, doc.y, { width: pageWidth, align: "left" });
  doc.moveDown(0.3);

  const subtitle = getReportSubtitle(options.type);
  doc.font("Helvetica").fontSize(11).fillColor(accent)
    .text(subtitle.toUpperCase(), LEFT, doc.y, { width: pageWidth, align: "left", characterSpacing: 1.5 });
  doc.moveDown(0.5);

  const dateRange = options.periodStart && options.periodEnd
    ? `${formatDateNice(options.periodStart)} — ${formatDateNice(options.periodEnd)}`
    : formatDateNice(options.createdAt);

  doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted)
    .text(`Generated ${dateRange}`, LEFT, doc.y, { width: pageWidth, align: "left" });
  doc.moveDown(0.6);

  const lineY = doc.y;
  doc.moveTo(LEFT, lineY).lineTo(RIGHT, lineY)
    .strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.moveDown(1.0);
}


function formatDateNice(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function checkPageBreak(doc: PDFKit.PDFDocument, neededHeight: number = 60) {
  if (doc.y + neededHeight > doc.page.height - 70) {
    doc.addPage();
    doc.y = 50;
  }
}

function renderMarkdownContent(
  doc: PDFKit.PDFDocument,
  content: string,
  pageWidth: number,
  LEFT: number,
  RIGHT: number,
  accent: string,
) {
  const lines = content.split("\n");
  let inList = false;
  let prevWasHeading = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "") {
      if (inList) {
        doc.moveDown(0.2);
        inList = false;
      } else if (!prevWasHeading) {
        doc.moveDown(0.4);
      }
      prevWasHeading = false;
      continue;
    }

    if (line.startsWith("# ")) {
      checkPageBreak(doc, 50);
      doc.moveDown(0.6);
      const headingText = line.replace(/^# /, "").trim();
      doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.heading1)
        .text(stripMarkdown(headingText), LEFT, doc.y, { width: pageWidth });
      doc.moveDown(0.25);
      const uy = doc.y;
      doc.moveTo(LEFT, uy).lineTo(LEFT + 50, uy)
        .strokeColor(accent).lineWidth(2.5).stroke();
      doc.moveDown(0.5);
      prevWasHeading = true;
      inList = false;
      continue;
    }

    if (line.startsWith("## ")) {
      checkPageBreak(doc, 45);
      doc.moveDown(0.5);
      const headingText = line.replace(/^## /, "").trim();
      doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.heading2)
        .text(stripMarkdown(headingText), LEFT, doc.y, { width: pageWidth });
      doc.moveDown(0.2);
      const uy = doc.y;
      doc.moveTo(LEFT, uy).lineTo(LEFT + 35, uy)
        .strokeColor(accent).lineWidth(1.5).stroke();
      doc.moveDown(0.45);
      prevWasHeading = true;
      inList = false;
      continue;
    }

    if (line.startsWith("### ")) {
      checkPageBreak(doc, 35);
      doc.moveDown(0.35);
      const headingText = line.replace(/^### /, "").trim();
      doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.heading3)
        .text(stripMarkdown(headingText), LEFT, doc.y, { width: pageWidth });
      doc.moveDown(0.3);
      prevWasHeading = true;
      inList = false;
      continue;
    }

    if (line.startsWith("#### ")) {
      checkPageBreak(doc, 30);
      doc.moveDown(0.25);
      const headingText = line.replace(/^#### /, "").trim();
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLORS.heading4)
        .text(stripMarkdown(headingText), LEFT, doc.y, { width: pageWidth });
      doc.moveDown(0.2);
      prevWasHeading = true;
      inList = false;
      continue;
    }

    if (line.match(/^---+$/)) {
      doc.moveDown(0.3);
      const sepY = doc.y;
      doc.moveTo(LEFT, sepY).lineTo(RIGHT, sepY)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      prevWasHeading = false;
      inList = false;
      continue;
    }

    prevWasHeading = false;

    if (line.match(/^\s*[-*]\s/)) {
      inList = true;
      checkPageBreak(doc, 18);
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      const indentLevel = Math.floor(indent / 2);
      const bulletText = line.replace(/^\s*[-*]\s/, "").trim();
      const leftOffset = indentLevel * 18;
      const bulletX = LEFT + 6 + leftOffset;
      const textX = LEFT + 18 + leftOffset;
      const textW = pageWidth - 18 - leftOffset;

      if (indentLevel === 0) {
        doc.circle(bulletX + 2, doc.y + 5, 2.2).fill(accent);
      } else {
        doc.circle(bulletX + 2, doc.y + 5, 1.8).lineWidth(0.8).strokeColor(COLORS.bulletSecondary).stroke();
      }

      renderRichText(doc, bulletText, 9.5, textW, textX, COLORS.body);
      doc.moveDown(0.2);
      continue;
    }

    if (line.match(/^\s*\d+\.\s/)) {
      inList = true;
      checkPageBreak(doc, 18);
      const numMatch = line.match(/^\s*(\d+)\.\s(.*)/);
      if (numMatch) {
        const numX = LEFT + 4;
        const textX = LEFT + 22;
        const textW = pageWidth - 22;

        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(accent)
          .text(`${numMatch[1]}.`, numX, doc.y, { continued: false });

        doc.moveUp();
        renderRichText(doc, numMatch[2].trim(), 9.5, textW, textX, COLORS.body);
        doc.moveDown(0.2);
      }
      continue;
    }

    checkPageBreak(doc, 16);
    renderRichText(doc, line.trim(), 9.5, pageWidth, LEFT, COLORS.body);
    doc.moveDown(0.2);
  }
}

function renderRichText(
  doc: PDFKit.PDFDocument,
  text: string,
  fontSize: number,
  width: number,
  x: number,
  color: string,
) {
  const parts = parseInlineFormatting(text);

  if (parts.length === 1 && !parts[0].bold) {
    doc.font("Helvetica").fontSize(fontSize).fillColor(color)
      .text(parts[0].text, x, doc.y, { width, lineGap: 2 });
    return;
  }

  const startY = doc.y;
  let first = true;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    const font = part.bold ? "Helvetica-Bold" : "Helvetica";
    const fc = part.bold ? COLORS.heading2 : color;

    doc.font(font).fontSize(fontSize).fillColor(fc);

    if (first) {
      doc.text(part.text, x, startY, { width, continued: !isLast, lineGap: 2 });
      first = false;
    } else {
      doc.text(part.text, { width, continued: !isLast, lineGap: 2 });
    }
  }
}

function parseInlineFormatting(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), bold: false });
  }

  if (parts.length === 0) {
    parts.push({ text, bold: false });
  }

  return parts;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}
