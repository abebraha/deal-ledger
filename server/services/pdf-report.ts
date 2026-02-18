import PDFDocument from "pdfkit";

interface PDFReportOptions {
  title: string;
  type: string;
  content: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  createdAt: string;
}

export function generateReportPDF(options: PDFReportOptions, outputStream: NodeJS.WritableStream): void {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    bufferPages: true,
  });

  doc.pipe(outputStream);

  const pageWidth = doc.page.width - 120;

  doc.font("Helvetica-Bold").fontSize(22).text("DealFlow", { align: "center" });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor("#666666")
    .text(options.type === "weekly" ? "Weekly Pipeline Update" : options.type === "biweekly" ? "CEO Biweekly Scorecard" : "Custom Report", { align: "center" });
  doc.moveDown(0.2);

  const dateRange = options.periodStart && options.periodEnd
    ? `${options.periodStart} — ${options.periodEnd}`
    : new Date(options.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.fontSize(9).fillColor("#999999").text(dateRange, { align: "center" });

  doc.moveDown(0.6);
  const lineY = doc.y;
  doc.moveTo(60, lineY).lineTo(doc.page.width - 60, lineY).strokeColor("#cccccc").lineWidth(1).stroke();
  doc.moveDown(1);

  doc.fillColor("#000000");
  renderMarkdownContent(doc, options.content, pageWidth);

  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor("#999999")
      .text(`Page ${i + 1} of ${pageCount}`, 60, doc.page.height - 40, { align: "center", width: pageWidth });
  }

  doc.end();
}

function renderMarkdownContent(doc: PDFKit.PDFDocument, content: string, pageWidth: number) {
  const lines = content.split("\n");
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "") {
      if (inList) {
        doc.moveDown(0.3);
        inList = false;
      } else {
        doc.moveDown(0.5);
      }
      continue;
    }

    if (line.startsWith("# ")) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#111111")
        .text(line.replace(/^# /, ""), { width: pageWidth });
      doc.moveDown(0.3);
      const underY = doc.y;
      doc.moveTo(60, underY).lineTo(doc.page.width - 60, underY).strokeColor("#dddddd").lineWidth(0.5).stroke();
      doc.moveDown(0.4);
      continue;
    }

    if (line.startsWith("## ")) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#222222")
        .text(line.replace(/^## /, ""), { width: pageWidth });
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith("### ")) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#333333")
        .text(line.replace(/^### /, ""), { width: pageWidth });
      doc.moveDown(0.2);
      continue;
    }

    if (line.startsWith("#### ")) {
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#444444")
        .text(line.replace(/^#### /, ""), { width: pageWidth });
      doc.moveDown(0.2);
      continue;
    }

    if (line.match(/^---+$/)) {
      doc.moveDown(0.3);
      const sepY = doc.y;
      doc.moveTo(60, sepY).lineTo(doc.page.width - 60, sepY).strokeColor("#dddddd").lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      continue;
    }

    if (line.match(/^\s*[-*]\s/)) {
      inList = true;
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      const indentLevel = Math.floor(indent / 2);
      const bulletText = line.replace(/^\s*[-*]\s/, "").trim();
      const leftMargin = 60 + indentLevel * 15;
      const bulletChar = indentLevel === 0 ? "•" : "◦";

      renderStyledLine(doc, `${bulletChar}  ${bulletText}`, 10, pageWidth - indentLevel * 15, leftMargin);
      doc.moveDown(0.15);
      continue;
    }

    if (line.match(/^\s*\d+\.\s/)) {
      inList = true;
      const numMatch = line.match(/^\s*(\d+)\.\s(.*)/);
      if (numMatch) {
        renderStyledLine(doc, `${numMatch[1]}.  ${numMatch[2]}`, 10, pageWidth, 60);
        doc.moveDown(0.15);
      }
      continue;
    }

    if (line.startsWith("**Subject") || line.startsWith("Subject")) {
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111")
        .text(stripMarkdown(line), { width: pageWidth });
      doc.moveDown(0.3);
      continue;
    }

    renderStyledLine(doc, line.trim(), 10, pageWidth, 60);
    doc.moveDown(0.15);
  }
}

function renderStyledLine(doc: PDFKit.PDFDocument, text: string, fontSize: number, width: number, x: number) {
  const parts = parseInlineFormatting(text);
  doc.fontSize(fontSize).fillColor("#333333");

  let currentX = x;
  const lineHeight = fontSize * 1.4;
  const startY = doc.y;

  for (const part of parts) {
    if (part.bold) {
      doc.font("Helvetica-Bold");
    } else {
      doc.font("Helvetica");
    }

    const textWidth = doc.widthOfString(part.text);

    if (currentX + textWidth > x + width && currentX > x) {
      doc.text(part.text, x, undefined, { width, continued: false });
      return;
    }
  }

  doc.font("Helvetica").text("", x, startY, { width });

  let fullText = "";
  for (const part of parts) {
    fullText += part.text;
  }
  
  const hasBold = parts.some(p => p.bold);
  if (hasBold && parts.length <= 3) {
    for (const part of parts) {
      doc.font(part.bold ? "Helvetica-Bold" : "Helvetica")
        .text(part.text, { continued: parts.indexOf(part) < parts.length - 1, width });
    }
  } else {
    doc.font("Helvetica").text(stripMarkdown(fullText), x, undefined, { width });
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
