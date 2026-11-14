export interface ParsedStreamFile {
  path: string;
  content: string;
}

export interface PartialPayloadSnapshot {
  files: ParsedStreamFile[];
  summary: string | null;
  isComplete: boolean;
}

function stripLeadingMarkdownFence(raw: string): string {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline !== -1) {
      return trimmed.slice(firstNewline + 1);
    }
  }
  return raw;
}

function unescapeJsonString(rawInner: string): string {
  // Fast safe decode via JSON.parse when possible, fallback manual unescape for partial strings
  try {
    return JSON.parse(`"${rawInner}"`) as string;
  } catch {
    return rawInner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

function extractCompletedFileObjectsFromJson(raw: string): ParsedStreamFile[] {
  const text = stripLeadingMarkdownFence(raw);
  const filesKeyIdx = text.search(/"files"\s*:/);
  if (filesKeyIdx === -1) return [];

  const bracketIdx = text.indexOf('[', filesKeyIdx);
  if (bracketIdx === -1) return [];

  const completed: ParsedStreamFile[] = [];
  let i = bracketIdx + 1;
  let inString = false;
  let escapeNext = false;
  let objDepth = 0;
  let objStart = -1;

  while (i < text.length) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
      i += 1;
      continue;
    }

    if (ch === '\\' && inString) {
      escapeNext = true;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      i += 1;
      continue;
    }

    if (!inString) {
      if (ch === '{') {
        if (objDepth === 0) objStart = i;
        objDepth += 1;
      } else if (ch === '}') {
        if (objDepth > 0) objDepth -= 1;
        if (objDepth === 0 && objStart !== -1) {
          const objSlice = text.slice(objStart, i + 1);
          objStart = -1;
          try {
            const parsed = JSON.parse(objSlice) as { path?: unknown; content?: unknown };
            if (
              typeof parsed.path === 'string' &&
              parsed.path.trim().length > 0 &&
              typeof parsed.content === 'string'
            ) {
              completed.push({
                path: parsed.path.trim().replace(/^\/+/, ''),
                content: parsed.content,
              });
            }
          } catch {
            // Skip malformed object slice
          }
        }
      } else if (ch === ']' && objDepth === 0) {
        break;
      }
    }

    i += 1;
  }

  return completed;
}

function extractSummaryFromPartialJson(raw: string): string | null {
  const m = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m?.[1]) {
    return unescapeJsonString(m[1]).trim() || null;
  }
  const xmlSummary = raw.match(/<summary>([\s\S]*?)<\/summary>/i);
  return xmlSummary?.[1]?.trim() || null;
}

function extractXmlFallbackFiles(raw: string): ParsedStreamFile[] {
  const files: ParsedStreamFile[] = [];
  const regex = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const filePath = match[1].trim().replace(/^\/+/, '');
    const content = match[2].replace(/^\n/, '').replace(/\n$/, '');
    if (filePath && content) {
      files.push({ path: filePath, content });
    }
  }
  return files;
}

/**
 * Pure helper inspecting a partially streamed JSON (or XML fallback) buffer and extracting
 * every file object that has completely closed so far.
 */
export function parsePartialGeneratedPayload(raw: string): PartialPayloadSnapshot {
  const jsonFiles = extractCompletedFileObjectsFromJson(raw);
  const files = jsonFiles.length > 0 ? jsonFiles : extractXmlFallbackFiles(raw);
  const summary = extractSummaryFromPartialJson(raw);

  let isComplete = false;
  const cleaned = stripLeadingMarkdownFence(raw)
    .replace(/```\s*$/, '')
    .trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const full = JSON.parse(cleaned) as { files?: unknown };
      if (Array.isArray(full.files)) isComplete = true;
    } catch {
      isComplete = false;
    }
  } else if (files.length > 0 && /<\/file>\s*(?:<summary>[\s\S]*<\/summary>)?\s*$/i.test(cleaned)) {
    isComplete = true;
  }

  return { files, summary, isComplete };
}

/**
 * Stateful streaming JSON file parser that emits newly completed files on each token chunk
 * without waiting for the entire LLM payload to close.
 */
export class StreamingJsonFileParser {
  private buffer = '';
  private emittedContents = new Map<string, string>();

  feed(chunk: string): ParsedStreamFile[] {
    if (!chunk) return [];
    this.buffer += chunk;

    const snapshot = parsePartialGeneratedPayload(this.buffer);
    const newlyCompleted: ParsedStreamFile[] = [];

    for (const file of snapshot.files) {
      const prev = this.emittedContents.get(file.path);
      if (prev !== file.content) {
        this.emittedContents.set(file.path, file.content);
        newlyCompleted.push(file);
      }
    }

    return newlyCompleted;
  }

  getSnapshot(): PartialPayloadSnapshot {
    return parsePartialGeneratedPayload(this.buffer);
  }

  getRawBuffer(): string {
    return this.buffer;
  }
}
