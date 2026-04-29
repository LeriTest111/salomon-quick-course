import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { legendGroups } from "../src/data/legend-groups.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, "../public/downloads/salomon-tech-legends-glossary.pdf");

const pageWidth = 595.28;
const pageHeight = 841.89;
const marginX = 54;
const marginTop = 60;
const marginBottom = 54;
const lineGap = 8;

const fonts = {
  regular: "F1",
  bold: "F2",
};

const escapePdfText = (value) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "")
    .replace(/\n/g, " ");

const normalizeText = (value) =>
  value
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[®]/g, "(R)")
    .replace(/[²]/g, "^2")
    .replace(/[–—]/g, "-")
    .replace(/[é]/g, "e")
    .replace(/[á]/g, "a")
    .replace(/[ë]/g, "e")
    .replace(/[í]/g, "i");

const measureText = (text, fontSize) => text.length * fontSize * 0.5;

const wrapText = (text, fontSize, maxWidth) => {
  const clean = normalizeText(text).trim();
  if (!clean) return [""];

  const words = clean.split(/\s+/);
  const lines = [];
  let current = words[0] ?? "";

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (measureText(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
};

const pages = [];
let currentPage = [];
let cursorY = pageHeight - marginTop;

const newPage = () => {
  if (currentPage.length > 0) pages.push(currentPage);
  currentPage = [];
  cursorY = pageHeight - marginTop;
};

const addLine = (text, options = {}) => {
  const {
    font = fonts.regular,
    size = 12,
    color = "0 0 0",
    indent = 0,
    gapBefore = 0,
    gapAfter = lineGap,
  } = options;

  cursorY -= gapBefore;
  if (cursorY < marginBottom) newPage();

  const x = marginX + indent;
  currentPage.push(
    `BT\n/${font} ${size} Tf\n${color} rg\n1 0 0 1 ${x.toFixed(2)} ${cursorY.toFixed(2)} Tm\n(${escapePdfText(
      text,
    )}) Tj\nET`,
  );
  cursorY -= size + gapAfter;
};

const addWrappedParagraph = (text, options = {}) => {
  const {
    font = fonts.regular,
    size = 12,
    color = "0 0 0",
    indent = 0,
    gapBefore = 0,
    gapAfter = 10,
  } = options;

  const maxWidth = pageWidth - marginX * 2 - indent;
  const lines = wrapText(text, size, maxWidth);

  cursorY -= gapBefore;
  for (const [index, line] of lines.entries()) {
    if (cursorY < marginBottom) newPage();
    const x = marginX + indent;
    currentPage.push(
      `BT\n/${font} ${size} Tf\n${color} rg\n1 0 0 1 ${x.toFixed(2)} ${cursorY.toFixed(2)} Tm\n(${escapePdfText(
        line,
      )}) Tj\nET`,
    );
    cursorY -= size + (index === lines.length - 1 ? gapAfter : 5);
  }
};

addLine("SALOMON", {
  font: fonts.bold,
  size: 24,
  color: "0 0 0",
  gapAfter: 6,
});
addLine("Tech Legends Glossary", {
  font: fonts.bold,
  size: 20,
  color: "0.12 0.12 0.12",
  gapAfter: 10,
});
addWrappedParagraph("A printable reference guide for the glossary content from Module 1.", {
  size: 12,
  color: "0.28 0.25 0.22",
  gapAfter: 18,
});

for (const group of legendGroups) {
  addLine(group.title.toUpperCase(), {
    font: fonts.bold,
    size: 16,
    color: "0.12 0.12 0.12",
    gapBefore: 6,
    gapAfter: 6,
  });
  addWrappedParagraph(group.detail, {
    size: 11,
    color: "0.38 0.34 0.31",
    gapAfter: 12,
  });

  for (const item of group.items) {
    addWrappedParagraph(item.title, {
      font: fonts.bold,
      size: 13,
      indent: 10,
      color: "0 0 0",
      gapAfter: 4,
    });
    addWrappedParagraph(item.summary, {
      size: 11,
      indent: 20,
      color: "0.22 0.22 0.22",
      gapAfter: item.meaning ? 4 : 10,
    });
    if (item.meaning) {
      addWrappedParagraph(item.meaning, {
        size: 11,
        indent: 20,
        color: "0.35 0.31 0.28",
        gapAfter: 10,
      });
    }
  }
}

newPage();

const objects = [];
const addObject = (content) => {
  objects.push(content);
  return objects.length;
};

const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

const pageIds = [];
const contentIds = [];

for (const pageCommands of pages) {
  const stream = pageCommands.join("\n");
  const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  contentIds.push(contentId);
  pageIds.push(
    addObject(
      `<< /Type /Page /Parent PAGES_REF /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /${fonts.regular} ${fontRegularId} 0 R /${fonts.bold} ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ),
  );
}

const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
const pagesId = addObject(`<< /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >>`);
const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

for (let index = 0; index < objects.length; index += 1) {
  if (objects[index].includes("PAGES_REF")) {
    objects[index] = objects[index].replaceAll("PAGES_REF", `${pagesId} 0 R`);
  }
}

let pdf = "%PDF-1.4\n";
const offsets = [0];

for (let index = 0; index < objects.length; index += 1) {
  offsets.push(Buffer.byteLength(pdf, "utf8"));
  pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
}

const xrefOffset = Buffer.byteLength(pdf, "utf8");
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += "0000000000 65535 f \n";

for (const offset of offsets.slice(1)) {
  pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
}

pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, pdf, "binary");

console.log(`PDF written to ${outputPath}`);
