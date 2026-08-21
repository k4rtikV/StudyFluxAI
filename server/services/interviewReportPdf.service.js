import PDFDocument from "pdfkit";

const COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  violet: "#7c3aed",
  cyan: "#0891b2",
  emerald: "#059669",
  rose: "#e11d48",
  slate: "#e2e8f0",
  paleViolet: "#f5f3ff",
  paleCyan: "#ecfeff",
  paleEmerald: "#ecfdf5",
  white: "#ffffff",
};

const clean = (value) =>
  String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/→/g, "->")
    .replace(/•/g, "-")
    .trim();

const pretty = (value) => clean(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const left = (doc) => doc.page.margins.left;
const contentBottom = (doc) => doc.page.height - doc.page.margins.bottom;

const resetFlow = (doc) => {
  doc.x = left(doc);
};

const flowText = (doc, text, options = {}) => {
  resetFlow(doc);
  doc.text(clean(text), left(doc), doc.y, {
    width: contentWidth(doc),
    ...options,
  });
  resetFlow(doc);
};

const ensureSpace = (doc, needed = 90) => {
  if (doc.y + needed > contentBottom(doc)) {
    doc.addPage();
    resetFlow(doc);
  }
};

const heading = (doc, text, color = COLORS.violet) => {
  ensureSpace(doc, 45);
  resetFlow(doc);
  doc.moveDown(0.6);
  doc.fillColor(color).font("Helvetica-Bold").fontSize(9).text(clean(text).toUpperCase(), left(doc), doc.y, {
    width: contentWidth(doc),
    characterSpacing: 0.8,
  });
  resetFlow(doc);
  doc.moveDown(0.35);
};

const bullet = (doc, text, color = COLORS.violet) => {
  const value = clean(text);
  if (!value) return;
  ensureSpace(doc, 38);
  const y = doc.y;
  doc.fillColor(color).font("Helvetica-Bold").fontSize(10).text("-", left(doc), y, { width: 12 });
  doc.fillColor(COLORS.ink).font("Helvetica").fontSize(10).text(value, left(doc) + 14, y, {
    width: contentWidth(doc) - 14,
    lineGap: 2,
  });
  resetFlow(doc);
  doc.moveDown(0.2);
};

const scoreBox = (doc, label, value, x, y, width) => {
  doc.roundedRect(x, y, width, 54, 9).fill(COLORS.paleViolet);
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(7.5).text(clean(label).toUpperCase(), x + 12, y + 10, {
    width: width - 24,
    characterSpacing: 0.5,
  });
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(16).text(clean(value), x + 12, y + 27, {
    width: width - 24,
  });
};

const contextPanel = (doc, lines) => {
  const values = lines.map(clean).filter(Boolean);
  if (!values.length) return;

  resetFlow(doc);
  const x = left(doc);
  const width = contentWidth(doc);
  const innerWidth = width - 24;

  doc.font("Helvetica").fontSize(9.5);
  const body = values.join("   |   ");
  const bodyHeight = doc.heightOfString(body, { width: innerWidth, lineGap: 2 });
  const height = Math.max(42, bodyHeight + 20);

  ensureSpace(doc, height + 8);
  const panelY = doc.y;
  doc.roundedRect(x, panelY, width, height, 9).fill(COLORS.paleCyan);
  doc.fillColor(COLORS.ink).font("Helvetica").fontSize(9.5).text(body, x + 12, panelY + 10, {
    width: innerWidth,
    lineGap: 2,
  });
  doc.y = panelY + height;
  resetFlow(doc);
};

const addPageFooters = (doc) => {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);

    const previousX = doc.x;
    const previousY = doc.y;
    const previousBottomMargin = doc.page.margins.bottom;
    const pageNumber = index - range.start + 1;

    // PDFKit auto-paginates text placed below the normal content bottom. Temporarily
    // remove the bottom margin so footer text can sit inside the physical page without
    // creating an extra blank page during the buffered-page numbering pass.
    doc.page.margins.bottom = 0;
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text(
      `StudyFluxAI | Smart Interview | Page ${pageNumber}`,
      left(doc),
      doc.page.height - 28,
      {
        width: contentWidth(doc),
        align: "center",
        lineBreak: false,
      },
    );
    doc.page.margins.bottom = previousBottomMargin;
    doc.x = previousX;
    doc.y = previousY;
  }
};

export const createInterviewReportPdfBuffer = async (interview) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const report = interview.finalReport || {};
      const turns = Array.isArray(interview.transcript) ? interview.transcript : [];

      doc.fillColor(COLORS.violet).font("Helvetica-Bold").fontSize(9).text("STUDYFLUXAI SMART INTERVIEW", left(doc), doc.y, {
        width: contentWidth(doc),
        characterSpacing: 1,
      });
      resetFlow(doc);
      doc.moveDown(0.35);
      doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(24).text(`${clean(interview.targetRole)} - Interview Report`, left(doc), doc.y, {
        width: contentWidth(doc),
      });
      resetFlow(doc);
      doc.moveDown(0.25);
      flowText(
        doc,
        `${pretty(interview.interviewType)} | ${pretty(interview.experienceLevel)} | Completed ${formatDate(interview.completedAt)}`,
        { lineGap: 1 },
      );
      doc.moveDown(0.8);

      const boxGap = 8;
      const boxWidth = (contentWidth(doc) - boxGap * 3) / 4;
      const startY = doc.y;
      scoreBox(doc, "Overall score", `${Number(report.overallScore || 0)}/100`, left(doc), startY, boxWidth);
      scoreBox(doc, "Answered", `${Number(report.answeredQuestions || 0)}/${Number(report.totalQuestions || turns.length)}`, left(doc) + boxWidth + boxGap, startY, boxWidth);
      scoreBox(doc, "Avg answer", `${Number(report.averageAnswerSeconds || 0)} sec`, left(doc) + (boxWidth + boxGap) * 2, startY, boxWidth);
      scoreBox(doc, "Est. pace", `${Number(report.estimatedAverageWpm || 0)} wpm`, left(doc) + (boxWidth + boxGap) * 3, startY, boxWidth);
      doc.y = startY + 68;
      resetFlow(doc);

      heading(doc, "Candidate context", COLORS.cyan);
      const profile = interview.profileSnapshot || {};
      const contextParts = [
        interview.useLearnerProfile === false ? "Learner profile: Excluded from interview scope" : "",
        interview.useLearnerProfile !== false && profile.educationLevel ? `Education: ${pretty(profile.educationLevel)}` : "",
        interview.useLearnerProfile !== false && profile.program ? `Program: ${clean(profile.program)}` : "",
        interview.useLearnerProfile !== false && profile.stream ? `Stream: ${clean(profile.stream)}` : "",
        interview.useLearnerProfile !== false && profile.institutionName ? `Institution: ${clean(profile.institutionName)}` : "",
        interview.resume?.fileName ? `Resume: ${clean(interview.resume.fileName)}` : "Resume: Not attached",
      ].filter(Boolean);
      contextPanel(doc, contextParts);

      heading(doc, "Performance summary");
      doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(15);
      flowText(doc, report.headline || "Interview practice report", { lineGap: 1 });
      doc.moveDown(0.35);
      doc.fillColor(COLORS.ink).font("Helvetica").fontSize(10.5);
      flowText(doc, report.summary, { lineGap: 3 });

      heading(doc, "Rubric averages", COLORS.cyan);
      const rubric = report.rubric || {};
      doc.fillColor(COLORS.ink).font("Helvetica").fontSize(10);
      flowText(
        doc,
        `Relevance ${Number(rubric.relevance || 0)}/10   |   Correctness ${Number(rubric.correctness || 0)}/10   |   Clarity ${Number(rubric.clarity || 0)}/10   |   Completeness ${Number(rubric.completeness || 0)}/10`,
        { lineGap: 2 },
      );

      heading(doc, "Strengths", COLORS.emerald);
      for (const item of report.strengths || []) bullet(doc, `${clean(item.title)}: ${clean(item.detail)}`, COLORS.emerald);

      heading(doc, "Highest-value improvements", COLORS.rose);
      for (const item of report.improvements || []) bullet(doc, `${clean(item.title)}: ${clean(item.detail)}`, COLORS.rose);

      heading(doc, "Practice plan", COLORS.violet);
      for (const item of report.practicePlan || []) bullet(doc, `[${pretty(item.priority)}] ${clean(item.focus)} - ${clean(item.action)}`, COLORS.violet);

      heading(doc, "Question-by-question review", COLORS.cyan);
      for (const turn of turns) {
        ensureSpace(doc, 150);
        resetFlow(doc);
        doc.roundedRect(left(doc), doc.y, contentWidth(doc), 1).fill(COLORS.slate);
        doc.moveDown(0.6);
        doc.fillColor(COLORS.violet).font("Helvetica-Bold").fontSize(9);
        flowText(doc, `QUESTION ${Number(turn.questionNumber || 0)} | ${pretty(turn.question?.category || "General")} | ${Number(turn.evaluation?.score || 0)}/100`);
        doc.moveDown(0.25);
        doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11);
        flowText(doc, turn.question?.text);
        doc.moveDown(0.25);
        doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8);
        flowText(doc, "YOUR ANSWER");
        doc.fillColor(COLORS.ink).font("Helvetica").fontSize(9.5);
        flowText(doc, clean(turn.answerTranscript) || "No verbal response", { lineGap: 2 });
        doc.moveDown(0.25);
        doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8);
        flowText(doc, "FEEDBACK");
        doc.fillColor(COLORS.ink).font("Helvetica").fontSize(9.5);
        flowText(doc, turn.evaluation?.summary, { lineGap: 2 });
        doc.moveDown(0.55);
      }

      if (interview.progressionReward) {
        heading(doc, "Progression earned", COLORS.violet);
        const reward = interview.progressionReward;
        doc.fillColor(COLORS.ink).font("Helvetica").fontSize(10);
        flowText(
          doc,
          `XP earned from this completion flow: +${Number(reward.xpEarned || 0)} XP. ` +
          (reward.antiFarmingApplied
            ? "Daily Smart Interview completion XP had already been earned for this learner-local day; one-time achievement XP may still have applied."
            : `Eligible interview completion XP: +${Number(reward.interviewCompletionXp || 0)} XP.`),
          { lineGap: 2 },
        );
      }

      heading(doc, "Practice note", COLORS.emerald);
      doc.fillColor(COLORS.ink).font("Helvetica").fontSize(10);
      flowText(doc, report.closingNote, { lineGap: 2 });
      doc.moveDown(0.4);
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8.5);
      flowText(doc, report.disclaimer || "This is AI-assisted mock-interview practice feedback, not a hiring decision.", { lineGap: 2 });

      addPageFooters(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

export const makeInterviewReportFilename = (interview) => {
  const role = String(interview?.targetRole || "smart-interview")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `${role || "smart-interview"}-report.pdf`;
};
