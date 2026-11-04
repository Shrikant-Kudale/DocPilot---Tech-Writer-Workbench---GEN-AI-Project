/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DocChunk {
  id: string;
  file: string;
  heading: string;
  content: string;
  tokens: number;
  wordCount?: number;
  createdAt: string;
  embedding?: number[];
}

/**
 * Estimates word count and token count heuristics (~1.3 tokens per word).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.round(words.length * 1.3);
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Splits a markdown document or plain text into logical chunks respecting heading hierarchy
 * with a target token window (default 500) and overlap (default 50).
 */
export function chunkMarkdown(
  file: string,
  markdown: string,
  targetTokens = 500,
  overlapTokens = 50
): DocChunk[] {
  if (!markdown || !markdown.trim()) return [];

  // Default fallback heading derived from friendly filename
  const friendlyFileTitle = file
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .trim();

  const lines = markdown.split('\n');
  const sections: { heading: string; lines: string[] }[] = [];

  let currentHeading = friendlyFileTitle || 'Document Overview';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          lines: [...currentLines],
        });
        currentLines = [];
      }
      currentHeading = headingMatch[2].trim();
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      lines: currentLines,
    });
  }

  const chunks: DocChunk[] = [];
  let chunkIndex = 1;

  for (const section of sections) {
    const sectionText = section.lines.join('\n').trim();
    const sectionTokens = estimateTokens(sectionText);
    const sectionWords = countWords(sectionText);

    if (sectionTokens <= targetTokens) {
      if (sectionText.length > 0) {
        chunks.push({
          id: `chunk-${cleanId(file)}-${chunkIndex++}`,
          file,
          heading: section.heading,
          content: sectionText,
          tokens: sectionTokens,
          wordCount: sectionWords,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      // Split into overlapping subchunks based on paragraphs
      const paragraphs = sectionText.split(/\n\n+/);
      let windowText = '';
      let windowTokens = 0;
      let partNumber = 1;

      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const pTokens = estimateTokens(p);

        if (windowTokens + pTokens > targetTokens && windowText.trim().length > 0) {
          const partSuffix = partNumber > 1 ? ` (Part ${partNumber})` : '';
          chunks.push({
            id: `chunk-${cleanId(file)}-${chunkIndex++}`,
            file,
            heading: `${section.heading}${partSuffix}`,
            content: windowText.trim(),
            tokens: windowTokens,
            wordCount: countWords(windowText),
            createdAt: new Date().toISOString(),
          });
          partNumber++;

          // Retain overlap from end of current window
          const prevLines = windowText.split('\n').filter(Boolean);
          const overlapLines = prevLines.slice(-3).join('\n');
          windowText = overlapLines ? `${overlapLines}\n\n${p}` : p;
          windowTokens = estimateTokens(windowText);
        } else {
          windowText = windowText ? `${windowText}\n\n${p}` : p;
          windowTokens += pTokens;
        }
      }

      if (windowText.trim().length > 0) {
        const partSuffix = partNumber > 1 ? ` (Part ${partNumber})` : '';
        chunks.push({
          id: `chunk-${cleanId(file)}-${chunkIndex++}`,
          file,
          heading: `${section.heading}${partSuffix}`,
          content: windowText.trim(),
          tokens: windowTokens,
          wordCount: countWords(windowText),
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return chunks;
}

function cleanId(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9_-]/g, '-');
}
