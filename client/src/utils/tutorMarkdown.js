const splitTableRow = (line) => {
  let value = String(line || "").trim();

  if (value.startsWith("|")) {
    value = value.slice(1);
  }

  if (value.endsWith("|")) {
    value = value.slice(0, -1);
  }

  return value.split("|").map((cell) => cell.trim());
};

const isTableDivider = (line) => {
  const cells = splitTableRow(line);

  return (
    cells.length > 1 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  );
};

const isHorizontalRule = (line) =>
  /^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(line);

const isTableStart = (lines, index, line) =>
  line.includes("|") &&
  index + 1 < lines.length &&
  isTableDivider(lines[index + 1]);

const isParagraphBoundary = (lines, index) => {
  const nextTrimmed = lines[index].trim();

  return (
    /^```/.test(nextTrimmed) ||
    /^(#{1,6})\s+/.test(nextTrimmed) ||
    isHorizontalRule(nextTrimmed) ||
    /^[-*+]\s+/.test(nextTrimmed) ||
    /^\d+[.)]\s+/.test(nextTrimmed) ||
    /^>\s?/.test(nextTrimmed) ||
    isTableStart(lines, index, nextTrimmed)
  );
};

const consumeCodeBlock = (lines, index, fenceMatch) => {
  const language = fenceMatch[1] || "";
  const codeLines = [];
  let nextIndex = index + 1;

  while (
    nextIndex < lines.length &&
    !/^```\s*$/.test(lines[nextIndex].trim())
  ) {
    codeLines.push(lines[nextIndex]);
    nextIndex += 1;
  }

  if (nextIndex < lines.length) {
    nextIndex += 1;
  }

  return {
    block: {
      type: "code",
      language,
      code: codeLines.join("\n"),
    },
    nextIndex,
  };
};

const consumeTable = (lines, index, line) => {
  const header = splitTableRow(line);
  const rows = [];
  let nextIndex = index + 2;

  while (
    nextIndex < lines.length &&
    lines[nextIndex].trim() &&
    lines[nextIndex].includes("|")
  ) {
    rows.push(splitTableRow(lines[nextIndex]));
    nextIndex += 1;
  }

  return {
    block: { type: "table", header, rows },
    nextIndex,
  };
};

const consumeList = (lines, index, pattern, itemPattern, type) => {
  const items = [];
  let nextIndex = index;

  while (nextIndex < lines.length && pattern.test(lines[nextIndex])) {
    items.push(lines[nextIndex].replace(itemPattern, "").trim());
    nextIndex += 1;
  }

  return {
    block: { type, items },
    nextIndex,
  };
};

const consumeQuote = (lines, index) => {
  const quoteLines = [];
  let nextIndex = index;

  while (
    nextIndex < lines.length &&
    /^>\s?/.test(lines[nextIndex].trimStart())
  ) {
    quoteLines.push(
      lines[nextIndex]
        .trimStart()
        .replace(/^>\s?/, ""),
    );
    nextIndex += 1;
  }

  return {
    block: {
      type: "quote",
      text: quoteLines.join(" ").trim(),
    },
    nextIndex,
  };
};

const consumeParagraph = (lines, index, line) => {
  const paragraphLines = [line.trim()];
  let nextIndex = index + 1;

  while (nextIndex < lines.length) {
    const nextTrimmed = lines[nextIndex].trim();

    if (!nextTrimmed || isParagraphBoundary(lines, nextIndex)) {
      break;
    }

    paragraphLines.push(nextTrimmed);
    nextIndex += 1;
  }

  return {
    block: {
      type: "paragraph",
      text: paragraphLines.join(" "),
    },
    nextIndex,
  };
};

const parseBlock = (lines, index, line) => {
  const fenceMatch = line.match(/^```\s*([^\s`]*)\s*$/);
  if (fenceMatch) {
    return consumeCodeBlock(lines, index, fenceMatch);
  }

  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    return {
      block: {
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      },
      nextIndex: index + 1,
    };
  }

  if (isHorizontalRule(line)) {
    return {
      block: { type: "rule" },
      nextIndex: index + 1,
    };
  }

  if (isTableStart(lines, index, line)) {
    return consumeTable(lines, index, line);
  }

  if (/^\s*[-*+]\s+/.test(line)) {
    return consumeList(
      lines,
      index,
      /^\s*[-*+]\s+/,
      /^\s*[-*+]\s+/,
      "unordered",
    );
  }

  if (/^\s*\d+[.)]\s+/.test(line)) {
    return consumeList(
      lines,
      index,
      /^\s*\d+[.)]\s+/,
      /^\s*\d+[.)]\s+/,
      "ordered",
    );
  }

  if (/^>\s?/.test(line)) {
    return consumeQuote(lines, index);
  }

  return consumeParagraph(lines, index, line);
};

export function parseTutorMarkdown(content) {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const parsed = parseBlock(lines, index, line);
    blocks.push(parsed.block);
    index = parsed.nextIndex;
  }

  return blocks;
}
