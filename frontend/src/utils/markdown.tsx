import "katex/dist/katex.min.css";
import React from "react";
import { BlockMath, InlineMath } from "react-katex";

// $...$ または $$...$$ を含む行をパースしてKaTeXでレンダリング
function parseMath(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // $$...$$ (ブロック数式) → インライン扱いだがBlockMathで表示
  const blockRegex = /\$\$([^$]+)\$\$/g;
  // $...$ (インライン数式)
  const inlineRegex = /\$([^$\n]+)\$/g;

  let lastIndex = 0;
  let key = 0;

  // まず $$...$$ を処理
  const segments: { start: number; end: number; node: React.ReactNode }[] = [];
  let m: RegExpExecArray | null;

  while ((m = blockRegex.exec(text)) !== null) {
    segments.push({
      start: m.index,
      end: m.index + m[0].length,
      node: <BlockMath key={key++} math={m[1]} />,
    });
  }
  while ((m = inlineRegex.exec(text)) !== null) {
    // $$...$$ の範囲と重ならない場合のみ
    const overlaps = segments.some(
      (s) => m!.index >= s.start && m!.index < s.end
    );
    if (!overlaps) {
      segments.push({
        start: m.index,
        end: m.index + m[0].length,
        node: <InlineMath key={key++} math={m[1]} />,
      });
    }
  }

  segments.sort((a, b) => a.start - b.start);

  for (const seg of segments) {
    if (seg.start > lastIndex) {
      parts.push(...parseInline(text.slice(lastIndex, seg.start), key++));
    }
    parts.push(seg.node);
    lastIndex = seg.end;
  }
  if (lastIndex < text.length) {
    parts.push(...parseInline(text.slice(lastIndex), key++));
  }
  return parts;
}

function parseInline(text: string, baseKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = baseKey * 1000;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const m = match[0];
    if (m.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="bg-gray-200 rounded px-1 py-0.5 text-sm font-mono"
        >
          {m.slice(1, -1)}
        </code>
      );
    } else if (m.startsWith("**") || m.startsWith("__")) {
      parts.push(<strong key={key++}>{m.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{m.slice(1, -1)}</em>);
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function parseLine(text: string): React.ReactNode[] {
  return parseMath(text);
}

export function renderMarkdown(text: string): React.ReactElement[] {
  const lines = text.split("\n");
  const result: React.ReactElement[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        result.push(
          <pre
            key={key++}
            className="bg-gray-200 rounded-md p-3 overflow-x-auto my-2 text-sm font-mono"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // $$...$$ が行全体を占める場合はブロック数式として独立表示
    const blockOnlyMatch = line.trim().match(/^\$\$([^$]+)\$\$$/);
    if (blockOnlyMatch) {
      result.push(
        <div key={key++} className="my-2">
          <BlockMath math={blockOnlyMatch[1]} />
        </div>
      );
      continue;
    }

    if (line.startsWith("### ")) {
      result.push(
        <h3 key={key++} className="font-semibold text-base mt-3 mb-1">
          {parseLine(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      result.push(
        <h2 key={key++} className="font-semibold text-lg mt-4 mb-1">
          {parseLine(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      result.push(
        <h1 key={key++} className="font-bold text-xl mt-4 mb-2">
          {parseLine(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      result.push(
        <li key={key++} className="ml-4 list-disc">
          {parseLine(line.slice(2))}
        </li>
      );
    } else if (/^\d+\. /.test(line)) {
      result.push(
        <li key={key++} className="ml-4 list-decimal">
          {parseLine(line.replace(/^\d+\. /, ""))}
        </li>
      );
    } else if (line === "") {
      result.push(<div key={key++} className="h-2" />);
    } else {
      result.push(
        <p key={key++} className="leading-relaxed">
          {parseLine(line)}
        </p>
      );
    }
  }

  return result;
}
