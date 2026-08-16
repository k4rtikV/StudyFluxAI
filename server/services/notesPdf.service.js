import PDFDocument from "pdfkit";

const COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  border: "#dbeafe",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  cyan: "#0891b2",
  emerald: "#059669",
  paleIndigo: "#eef2ff",
  paleEmerald: "#ecfdf5",
  paleCyan: "#ecfeff",
  white: "#ffffff",
};

const sanitizeText = (value) =>
  String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/→/g, "->")
    .replace(/•/g, "-")
    .trim();

const prettify = (value) =>
  sanitizeText(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getContentWidth = (doc) =>
  doc.page.width -
  doc.page.margins.left -
  doc.page.margins.right;

const resetFlowX = (doc) => {
  doc.x = doc.page.margins.left;
};

const addRoundedLabel = (
  doc,
  {
    label,
    value,
    x,
    y,
    width,
  },
) => {
  doc
    .roundedRect(x, y, width, 44, 8)
    .fill(COLORS.paleIndigo);

  doc
    .fillColor(COLORS.muted)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text(
      sanitizeText(label).toUpperCase(),
      x + 12,
      y + 9,
      {
        width: width - 24,
        characterSpacing: 0.6,
        lineBreak: false,
      },
    );

  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(
      sanitizeText(value) || "-",
      x + 12,
      y + 23,
      {
        width: width - 24,
        ellipsis: true,
        lineBreak: false,
      },
    );
};

const addSectionHeading = (
  doc,
  text,
  color = COLORS.violet,
) => {
  resetFlowX(doc);
  doc.moveDown(0.5);

  const y = doc.y;

  doc
    .fillColor(color)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      sanitizeText(text).toUpperCase(),
      doc.page.margins.left,
      y,
      {
        width: getContentWidth(doc),
        characterSpacing: 0.8,
      },
    );

  resetFlowX(doc);
  doc.moveDown(0.35);
};

const addBulletList = (
  doc,
  items,
  {
    color = COLORS.indigo,
    fontSize = 10.5,
  } = {},
) => {
  for (const item of items || []) {
    const text = sanitizeText(item);

    if (!text) {
      continue;
    }

    resetFlowX(doc);
    const startY = doc.y;

    doc
      .fillColor(color)
      .font("Helvetica-Bold")
      .fontSize(fontSize)
      .text("-", doc.page.margins.left, startY, {
        width: 10,
        lineBreak: false,
      });

    doc
      .fillColor(COLORS.ink)
      .font("Helvetica")
      .fontSize(fontSize)
      .text(
        text,
        doc.page.margins.left + 14,
        startY,
        {
          width: getContentWidth(doc) - 14,
          lineGap: 2,
        },
      );

    resetFlowX(doc);
    doc.moveDown(0.25);
  }

  resetFlowX(doc);
};


const measureCompactClosingListHeight = (
  doc,
  items,
) => {
  const cleanItems = (items || [])
    .map((item) => sanitizeText(item))
    .filter(Boolean);

  if (cleanItems.length === 0) {
    return 0;
  }

  const width = getContentWidth(doc) - 14;

  doc.font("Helvetica-Bold").fontSize(8.5);
  const headingHeight = doc.heightOfString("SUMMARY", {
    width: getContentWidth(doc),
  });

  doc.font("Helvetica").fontSize(9.5);
  const listHeight = cleanItems.reduce(
    (total, item) =>
      total +
      doc.heightOfString(item, {
        width,
        lineGap: 1.25,
      }) +
      1.5,
    0,
  );

  return 7 + headingHeight + 5 + listHeight + 3;
};

const addCompactClosingList = (
  doc,
  {
    title,
    items,
    color,
  },
) => {
  const cleanItems = (items || [])
    .map((item) => sanitizeText(item))
    .filter(Boolean);

  if (cleanItems.length === 0) {
    return;
  }

  resetFlowX(doc);
  doc.y += 7;

  doc
    .fillColor(color)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(
      sanitizeText(title).toUpperCase(),
      doc.page.margins.left,
      doc.y,
      {
        width: getContentWidth(doc),
        characterSpacing: 0.7,
      },
    );

  resetFlowX(doc);
  doc.y += 5;

  const fontSize = 9.5;
  const textX = doc.page.margins.left + 14;
  const textWidth = getContentWidth(doc) - 14;

  for (const item of cleanItems) {
    const startY = doc.y;

    doc
      .fillColor(color)
      .font("Helvetica-Bold")
      .fontSize(fontSize)
      .text("-", doc.page.margins.left, startY, {
        width: 10,
        lineBreak: false,
      });

    doc
      .fillColor(COLORS.ink)
      .font("Helvetica")
      .fontSize(fontSize);

    const textHeight = doc.heightOfString(item, {
      width: textWidth,
      lineGap: 1.25,
    });

    doc.text(item, textX, startY, {
      width: textWidth,
      lineGap: 1.25,
    });

    doc.y = startY + textHeight + 1.5;
    resetFlowX(doc);
  }

  doc.y += 3;
  resetFlowX(doc);
};

const ensureRoom = (
  doc,
  minimumHeight = 90,
) => {
  const bottom =
    doc.page.height - doc.page.margins.bottom;

  if (doc.y + minimumHeight > bottom) {
    doc.addPage();
    resetFlowX(doc);
  }
};

const addCallout = (
  doc,
  {
    title,
    text,
    fill,
    border,
  },
) => {
  const clean = sanitizeText(text);

  if (!clean) {
    return;
  }

  const width = getContentWidth(doc);
  const bodyHeight = doc.heightOfString(clean, {
    width: width - 28,
    lineGap: 2,
  });
  const height = Math.max(72, 42 + bodyHeight);

  ensureRoom(doc, height + 12);
  resetFlowX(doc);

  const x = doc.page.margins.left;
  const y = doc.y;

  doc
    .roundedRect(x, y, width, height, 10)
    .fillAndStroke(fill, border);

  doc
    .fillColor(border)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(
      sanitizeText(title).toUpperCase(),
      x + 14,
      y + 13,
      {
        width: width - 28,
        characterSpacing: 0.7,
        lineBreak: false,
      },
    );

  doc
    .fillColor(COLORS.ink)
    .font("Helvetica")
    .fontSize(10.5)
    .text(clean, x + 14, y + 31, {
      width: width - 28,
      lineGap: 2,
    });

  doc.y = y + height + 8;
  resetFlowX(doc);
};

const drawPageFooters = (doc) => {
  const range = doc.bufferedPageRange();

  for (
    let pageIndex = range.start;
    pageIndex < range.start + range.count;
    pageIndex += 1
  ) {
    doc.switchToPage(pageIndex);

    const originalBottomMargin =
      doc.page.margins.bottom;
    const footerY = doc.page.height - 34;

    // Footer text deliberately lives inside the bottom margin.
    // Temporarily remove that margin so PDFKit does not auto-create
    // overflow pages while positioning the footer.
    doc.page.margins.bottom = 0;

    doc
      .moveTo(
        doc.page.margins.left,
        footerY - 8,
      )
      .lineTo(
        doc.page.width -
          doc.page.margins.right,
        footerY - 8,
      )
      .strokeColor("#e2e8f0")
      .lineWidth(0.6)
      .stroke();

    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        "Generated with StudyFluxAI",
        doc.page.margins.left,
        footerY,
        {
          width: 220,
          align: "left",
          lineBreak: false,
        },
      );

    doc.text(
      `Page ${pageIndex - range.start + 1} of ${range.count}`,
      doc.page.width -
        doc.page.margins.right -
        120,
      footerY,
      {
        width: 120,
        align: "right",
        lineBreak: false,
      },
    );

    doc.page.margins.bottom = originalBottomMargin;
  }
};

export const createNotesPdfBuffer = async (
  studySession,
) => {
  const output = studySession?.output;
  const notes = output?.notes;

  if (!notes) {
    const error = new Error(
      "This learning item does not contain AI Notes.",
    );
    error.code = "NOTES_NOT_AVAILABLE";
    throw error;
  }

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 48,
      right: 48,
      bottom: 54,
      left: 48,
    },
    bufferPages: true,
    info: {
      Title:
        sanitizeText(output.sessionTitle) ||
        "StudyFluxAI Notes",
      Author: "StudyFluxAI",
      Subject:
        sanitizeText(output.shortDescription) ||
        "AI-generated study notes",
      Creator: "StudyFluxAI",
    },
  });

  const chunks = [];

  const completed = new Promise(
    (resolve, reject) => {
      doc.on("data", (chunk) =>
        chunks.push(chunk),
      );
      doc.on("end", () =>
        resolve(Buffer.concat(chunks)),
      );
      doc.on("error", reject);
    },
  );

  const contentWidth = getContentWidth(doc);
  const left = doc.page.margins.left;

  // Brand header
  const headerY = doc.y;

  doc
    .roundedRect(
      left,
      headerY,
      contentWidth,
      64,
      12,
    )
    .fill(COLORS.ink);

  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(
      "StudyFluxAI",
      left + 18,
      headerY + 15,
      {
        width: 190,
        lineBreak: false,
      },
    );

  doc
    .fillColor("#c4b5fd")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(
      "AI STUDY NOTES",
      left + 18,
      headerY + 39,
      {
        width: 190,
        characterSpacing: 1.2,
        lineBreak: false,
      },
    );

  doc
    .fillColor("#a7f3d0")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(
      formatDate(
        studySession.completedAt ||
          studySession.createdAt,
      ),
      doc.page.width -
        doc.page.margins.right -
        150,
      headerY + 26,
      {
        width: 132,
        align: "right",
        lineBreak: false,
      },
    );

  doc.y = headerY + 82;
  resetFlowX(doc);

  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(
      sanitizeText(output.sessionTitle) ||
        "Study Notes",
      left,
      doc.y,
      {
        width: contentWidth,
        lineGap: 2,
      },
    );

  resetFlowX(doc);

  if (output.shortDescription) {
    doc.moveDown(0.4);
    const descriptionY = doc.y;

    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(10.5)
      .text(
        sanitizeText(
          output.shortDescription,
        ),
        left,
        descriptionY,
        {
          width: contentWidth,
          lineGap: 3,
        },
      );

    resetFlowX(doc);
  }

  const context =
    studySession.academicContext || {};

  const contextRows = [
    {
      label: "Education level",
      value: prettify(
        context.educationLevel,
      ),
    },
    {
      label:
        context.institutionType === "board"
          ? "Board"
          : "Institution",
      value: context.institutionName,
    },
    {
      label: "Program / Degree",
      value: context.program,
    },
    {
      label: "Stream / Specialization",
      value: context.stream,
    },
  ].filter((item) => item.value);

  if (contextRows.length > 0) {
    ensureRoom(doc, 120);
    addSectionHeading(
      doc,
      "Academic context",
      COLORS.cyan,
    );

    const gap = 8;
    const cardWidth =
      (contentWidth - gap) / 2;
    const cardsY = doc.y;

    contextRows.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const x =
        left + column * (cardWidth + gap);
      const y = cardsY + row * 52;

      addRoundedLabel(doc, {
        ...item,
        x,
        y,
        width: cardWidth,
      });
    });

    const rows =
      Math.ceil(contextRows.length / 2);
    doc.y = cardsY + rows * 52 + 4;
    resetFlowX(doc);
  }

  ensureRoom(doc, 100);
  addSectionHeading(
    doc,
    "Overview",
    COLORS.indigo,
  );

  const overviewY = doc.y;
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica")
    .fontSize(11)
    .text(
      sanitizeText(notes.overview),
      left,
      overviewY,
      {
        width: contentWidth,
        lineGap: 3,
      },
    );
  resetFlowX(doc);

  for (
    let index = 0;
    index < (notes.sections || []).length;
    index += 1
  ) {
    const section = notes.sections[index];

    ensureRoom(doc, 130);
    resetFlowX(doc);
    doc.moveDown(0.8);

    const sectionLabelY = doc.y;
    doc
      .fillColor(COLORS.violet)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(
        `SECTION ${index + 1}`,
        left,
        sectionLabelY,
        {
          width: contentWidth,
          characterSpacing: 0.8,
        },
      );

    resetFlowX(doc);
    doc.moveDown(0.2);

    const sectionHeadingY = doc.y;
    doc
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(
        sanitizeText(section.heading),
        left,
        sectionHeadingY,
        {
          width: contentWidth,
          lineGap: 2,
        },
      );

    resetFlowX(doc);
    doc.moveDown(0.35);

    const sectionBodyY = doc.y;
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(COLORS.ink)
      .text(
        sanitizeText(
          section.explanation,
        ),
        left,
        sectionBodyY,
        {
          width: contentWidth,
          lineGap: 3,
        },
      );

    resetFlowX(doc);

    if (
      Array.isArray(section.keyPoints) &&
      section.keyPoints.length > 0
    ) {
      ensureRoom(doc, 90);
      doc.moveDown(0.45);

      const keyPointsY = doc.y;
      doc
        .fillColor(COLORS.indigo)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("KEY POINTS", left, keyPointsY, {
          width: contentWidth,
          characterSpacing: 0.7,
        });

      resetFlowX(doc);
      doc.moveDown(0.25);
      addBulletList(
        doc,
        section.keyPoints,
      );
    }

    if (section.example) {
      doc.moveDown(0.25);
      addCallout(doc, {
        title: "Example",
        text: section.example,
        fill: COLORS.paleEmerald,
        border: COLORS.emerald,
      });
    }
  }

  const takeaways = Array.isArray(notes.keyTakeaways)
    ? notes.keyTakeaways
    : [];
  const checklist = Array.isArray(notes.revisionChecklist)
    ? notes.revisionChecklist.map(
        (item) => `[ ] ${item}`,
      )
    : [];

  const takeawayHeight =
    measureCompactClosingListHeight(
      doc,
      takeaways,
    );
  const checklistHeight =
    measureCompactClosingListHeight(
      doc,
      checklist,
    );

  if (takeawayHeight > 0) {
    ensureRoom(doc, takeawayHeight);
    addCompactClosingList(doc, {
      title: "Key takeaways",
      items: takeaways,
      color: COLORS.cyan,
    });
  }

  if (checklistHeight > 0) {
    // Measure the real compact checklist height instead of reserving a
    // fixed 110pt block. This lets short checklists use the remaining
    // space at the bottom of the current page whenever they actually fit.
    ensureRoom(doc, checklistHeight);
    addCompactClosingList(doc, {
      title: "Revision checklist",
      items: checklist,
      color: COLORS.emerald,
    });
  }

  drawPageFooters(doc);
  doc.end();

  return completed;
};