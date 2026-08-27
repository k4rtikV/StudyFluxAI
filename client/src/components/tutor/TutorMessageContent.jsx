const inlinePattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\$[^$\n]+\$|\[[^\]\n]+\]\([^)\n]+\))/g;

const subscriptDigits = {
  0: "₀",
  1: "₁",
  2: "₂",
  3: "₃",
  4: "₄",
  5: "₅",
  6: "₆",
  7: "₇",
  8: "₈",
  9: "₉",
};

const normalizeMathText = (value) =>
  String(value || "")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\rightarrow|\\to/g, "→")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\pm/g, "±")
    .replace(/_\{(\d+)\}/g, (_, digits) =>
      [...digits].map((digit) => subscriptDigits[digit] || digit).join(""),
    )
    .replace(/_(\d+)/g, (_, digits) =>
      [...digits].map((digit) => subscriptDigits[digit] || digit).join(""),
    )
    .replace(/[{}]/g, "")
    .replace(/\\/g, "");

function InlineText({ text }) {
  const parts = String(text || "").split(inlinePattern);

  return parts.map((part, index) => {
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return (
        <strong
          key={`${part}-${index}`}
          className="font-extrabold text-inherit"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${part}-${index}`}
          className="rounded-md bg-slate-900/7 px-1.5 py-0.5 font-mono text-[0.92em] text-violet-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("$") && part.endsWith("$")) {
      return (
        <span
          key={`${part}-${index}`}
          className="rounded-md bg-violet-50 px-1.5 py-0.5 font-mono text-[0.92em] font-semibold text-violet-700"
        >
          {normalizeMathText(part.slice(1, -1))}
        </span>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (linkMatch) {
      const [, label, href] = linkMatch;
      const safeHref = /^https?:\/\//i.test(href) ? href : null;

      if (safeHref) {
        return (
          <a
            key={`${part}-${index}`}
            href={safeHref}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-violet-700 underline decoration-violet-300 underline-offset-2 transition hover:text-violet-900"
          >
            {label}
          </a>
        );
      }
    }

    return part;
  });
}

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

function MarkdownTable({ header, rows, blockIndex }) {
  return (
    <div
      key={`table-${blockIndex}`}
      className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
    >
      <table className="min-w-[640px] w-full border-collapse text-left text-sm leading-7">
        <thead className="bg-gradient-to-r from-violet-50 via-indigo-50 to-cyan-50">
          <tr>
            {header.map((cell, index) => (
              <th
                key={`${cell}-${index}`}
                className="border-b border-slate-200 px-4 py-3 align-top text-xs font-extrabold uppercase tracking-[0.06em] text-slate-700"
              >
                <InlineText text={cell} />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`row-${rowIndex}`}
              className="border-b border-slate-100 last:border-b-0 even:bg-slate-50/55"
            >
              {header.map((_, cellIndex) => (
                <td
                  key={`cell-${rowIndex}-${cellIndex}`}
                  className="px-4 py-3.5 align-top leading-7 text-slate-600"
                >
                  <InlineText text={row[cellIndex] || ""} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const headingClasses = {
  1: "text-xl font-black tracking-tight text-slate-950 sm:text-2xl",
  2: "text-lg font-black tracking-tight text-slate-950 sm:text-xl",
  3: "text-base font-extrabold text-slate-950 sm:text-lg",
  4: "text-sm font-extrabold uppercase tracking-[0.06em] text-slate-700",
  5: "text-sm font-extrabold text-slate-800",
  6: "text-sm font-bold text-slate-700",
};

function parseMarkdown(content) {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenceMatch = line.match(/^```\s*([^\s`]*)\s*$/);

    if (fenceMatch) {
      const language = fenceMatch[1] || "";
      const codeLines = [];
      index += 1;

      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        type: "code",
        language,
        code: codeLines.join("\n"),
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1])
    ) {
      const header = splitTableRow(line);
      const rows = [];
      index += 2;

      while (
        index < lines.length &&
        lines[index].trim() &&
        lines[index].includes("|")
      ) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }

      blocks.push({
        type: "table",
        header,
        rows,
      });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];

      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, "").trim());
        index += 1;
      }

      blocks.push({ type: "unordered", items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];

      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, "").trim());
        index += 1;
      }

      blocks.push({ type: "ordered", items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];

      while (index < lines.length && /^>\s?/.test(lines[index].trimStart())) {
        quoteLines.push(lines[index].trimStart().replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push({
        type: "quote",
        text: quoteLines.join(" ").trim(),
      });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;

    while (index < lines.length) {
      const next = lines[index];
      const nextTrimmed = next.trim();

      if (!nextTrimmed) {
        break;
      }

      if (
        /^```/.test(nextTrimmed) ||
        /^(#{1,6})\s+/.test(nextTrimmed) ||
        isHorizontalRule(nextTrimmed) ||
        /^[-*+]\s+/.test(nextTrimmed) ||
        /^\d+[.)]\s+/.test(nextTrimmed) ||
        /^>\s?/.test(nextTrimmed) ||
        (nextTrimmed.includes("|") &&
          index + 1 < lines.length &&
          isTableDivider(lines[index + 1]))
      ) {
        break;
      }

      paragraphLines.push(nextTrimmed);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function TutorMessageContent({ content }) {
  const blocks = parseMarkdown(content);

  return (
    <div className="space-y-5 text-sm leading-7 text-slate-600 sm:text-[15px]">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <div
              key={`heading-${index}`}
              className={headingClasses[block.level] || headingClasses[3]}
            >
              <InlineText text={block.text} />
            </div>
          );
        }

        if (block.type === "rule") {
          return (
            <hr
              key={`rule-${index}`}
              className="my-1 border-0 border-t border-slate-200"
            />
          );
        }

        if (block.type === "table") {
          return (
            <MarkdownTable
              key={`table-${index}`}
              header={block.header}
              rows={block.rows}
              blockIndex={index}
            />
          );
        }

        if (block.type === "unordered") {
          return (
            <ul
              key={`unordered-${index}`}
              className="space-y-2 pl-5"
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={`${item}-${itemIndex}`}
                  className="list-disc pl-1 marker:text-violet-500"
                >
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered") {
          return (
            <ol
              key={`ordered-${index}`}
              className="space-y-2 pl-5"
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={`${item}-${itemIndex}`}
                  className="list-decimal pl-1 marker:font-bold marker:text-slate-500"
                >
                  <InlineText text={item} />
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={`quote-${index}`}
              className="rounded-2xl border-l-4 border-violet-300 bg-violet-50/72 px-4 py-3.5 italic text-slate-600"
            >
              <InlineText text={block.text} />
            </blockquote>
          );
        }

        if (block.type === "code") {
          return (
            <div
              key={`code-${index}`}
              className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.22)]"
            >
              {block.language && (
                <div className="border-b border-slate-800 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  {block.language}
                </div>
              )}

              <pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-100 sm:text-sm">
                <code>{block.code.trim()}</code>
              </pre>
            </div>
          );
        }

        return (
          <p
            key={`paragraph-${index}`}
            className="whitespace-pre-wrap"
          >
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

export default TutorMessageContent;
