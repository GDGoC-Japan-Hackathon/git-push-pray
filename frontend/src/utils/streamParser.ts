/**
 * 不完全なJSON文字列からフィールド値を抽出する。
 * Gemini structured output のストリーミングで、生成途中のJSONからreplyやcodeを取得するために使用。
 */
export function extractJSONStringField(
  partialJSON: string,
  field: string
): string | null {
  // "field": "value..." or "field":"value..." を探す
  const pattern = new RegExp(`"${field}"\\s*:\\s*"`);
  const match = pattern.exec(partialJSON);
  if (!match) return null;

  let result = "";
  let i = match.index + match[0].length;
  let escaped = false;

  while (i < partialJSON.length) {
    const ch = partialJSON[i];
    if (escaped) {
      switch (ch) {
        case "n":
          result += "\n";
          break;
        case "t":
          result += "\t";
          break;
        case "r":
          result += "\r";
          break;
        case '"':
          result += '"';
          break;
        case "\\":
          result += "\\";
          break;
        case "/":
          result += "/";
          break;
        case "u": {
          // Unicode escape: \uXXXX
          const hex = partialJSON.slice(i + 1, i + 5);
          if (hex.length === 4) {
            result += String.fromCharCode(parseInt(hex, 16));
            i += 4;
          }
          break;
        }
        default:
          result += ch;
      }
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === '"') {
      break; // 文字列の終端
    } else {
      result += ch;
    }
    i++;
  }

  return result;
}

/**
 * SSEレスポンスをストリーミングで読み取り、イベントごとにコールバックを呼ぶ。
 */
export async function readSSEStream(
  response: Response,
  onEvent: (event: string, data: string) => void | Promise<void>
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    // body が無い場合はレスポンス全体をテキストとしてパース
    const text = await response.text();
    await parseSSEText(text, onEvent);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // バッファ内の完了したイベントを処理
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const block of events) {
        await processSSEBlock(block, onEvent);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // デコーダに残っているマルチバイト文字をフラッシュ
  buffer += decoder.decode();

  // 残りのバッファを処理
  if (buffer.trim()) {
    await processSSEBlock(buffer, onEvent);
  }
}

async function processSSEBlock(
  block: string,
  onEvent: (event: string, data: string) => void | Promise<void>
) {
  if (!block.trim()) return;
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7);
    else if (line.startsWith("data: ")) data = line.slice(6);
  }
  if (data) await onEvent(event, data);
}

async function parseSSEText(
  text: string,
  onEvent: (event: string, data: string) => void | Promise<void>
) {
  for (const block of text.split("\n\n")) {
    await processSSEBlock(block, onEvent);
  }
}
