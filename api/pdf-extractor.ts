/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import zlib from 'zlib';

/**
 * Validates whether a text string contains raw binary PDF artifacts.
 * If this returns true, the string must NOT be treated as parsed human text.
 */
export function isRawPdfBinary(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const sample = text.slice(0, 3000);
  return (
    sample.includes('%PDF-') ||
    sample.includes('ReportLab Generated') ||
    sample.includes('/MediaBox') ||
    sample.includes('/Contents') ||
    sample.includes('/FlateDecode') ||
    sample.includes('/ASCII85Decode') ||
    sample.includes('endobj') ||
    sample.includes('trailer <<') ||
    sample.includes('startxref') ||
    sample.includes('<< /Filter') ||
    sample.includes('obj <<')
  );
}

/**
 * Decodes ASCII85 (Adobe Base85) encoded strings commonly found in ReportLab and Acrobat PDFs.
 */
export function decodeAscii85(input: string): Buffer {
  let clean = input.replace(/\s+/g, '');
  if (clean.startsWith('<~')) clean = clean.slice(2);
  if (clean.endsWith('~>')) clean = clean.slice(0, -2);

  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 5) {
    const chunk = clean.slice(i, i + 5);
    if (chunk === 'z') {
      out.push(0, 0, 0, 0);
      i -= 4;
      continue;
    }
    let val = 0;
    const pad = 5 - chunk.length;
    for (let j = 0; j < 5; j++) {
      const c = j < chunk.length ? chunk.charCodeAt(j) - 33 : 84;
      val = val * 85 + c;
    }
    for (let b = 3; b >= pad; b--) {
      out.push((val >> (b * 8)) & 0xff);
    }
  }
  return Buffer.from(out);
}

function cleanPdfString(raw: string): string {
  return raw
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\[0-7]{3}/g, '"') // Map octal quotes to clean quotes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .trim();
}

/**
 * Extracts human-readable plain text blocks from PDF content stream respecting BT ... ET boundaries.
 */
export function extractTextFromPdfStream(streamStr: string): string[] {
  const blocks: string[] = [];

  // Look for text blocks enclosed in BT ... ET
  const btRegex = /BT([\s\S]*?)ET/g;
  let btm: RegExpExecArray | null;

  while ((btm = btRegex.exec(streamStr)) !== null) {
    const inner = btm[1];
    const pieces: string[] = [];

    // Match (text) Tj or ' or "
    const tjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
    let tjm: RegExpExecArray | null;
    while ((tjm = tjRegex.exec(inner)) !== null) {
      const cleaned = cleanPdfString(tjm[1]);
      if (cleaned) pieces.push(cleaned);
    }

    // Match [(text) 20 (more text)] TJ
    const arrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let am: RegExpExecArray | null;
    while ((am = arrayRegex.exec(inner)) !== null) {
      const innerArr = am[1];
      const innerTjRegex = /\(([\s\S]*?)\)/g;
      let im: RegExpExecArray | null;
      while ((im = innerTjRegex.exec(innerArr)) !== null) {
        const cleaned = cleanPdfString(im[1]);
        if (cleaned) pieces.push(cleaned);
      }
    }

    if (pieces.length > 0) {
      const blockText = pieces.join(' ').replace(/\s{2,}/g, ' ').trim();
      if (blockText.length > 0) {
        blocks.push(blockText);
      }
    }
  }

  // If no BT ... ET were present, fallback to raw Tj scan
  if (blocks.length === 0) {
    const pieces: string[] = [];
    const tjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
    let tjm: RegExpExecArray | null;
    while ((tjm = tjRegex.exec(streamStr)) !== null) {
      const cleaned = cleanPdfString(tjm[1]);
      if (cleaned) pieces.push(cleaned);
    }
    if (pieces.length > 0) {
      blocks.push(pieces.join(' ').trim());
    }
  }

  return blocks;
}

/**
 * Formats extracted PDF text blocks into well-structured markdown with proper headings and paragraphs.
 */
export function formatBlocksIntoMarkdown(docTitle: string, blocks: string[]): string {
  if (blocks.length === 0) return '';

  const cleanDocTitle = docTitle.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const markdownSections: string[] = [];
  let isFirstHeading = true;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i].trim();
    if (!b) continue;

    // Check if this block is a section heading:
    // Standalone, short (< 80 chars), no trailing sentence punctuation, or title/chapter keyword
    const isHeading =
      b.length < 80 &&
      !/[.!?,;:]$/.test(b) &&
      !/^(page\s+\d+|\d+)$/i.test(b) &&
      (i === 0 ||
        /^[A-Z0-9\s,:'"-]+$/.test(b) ||
        /^(chapter|section|part|principle|\d+[\.:])\s+/i.test(b) ||
        /^[A-Z][a-z0-9]+(\s+[A-Z0-9][a-z0-9]*)*$/.test(b));

    if (isHeading) {
      if (isFirstHeading) {
        markdownSections.push(`# ${b}`);
        isFirstHeading = false;
      } else {
        markdownSections.push(`## ${b}`);
      }
    } else {
      markdownSections.push(b);
    }
  }

  let finalMarkdown = markdownSections.join('\n\n');
  if (!finalMarkdown.startsWith('#')) {
    finalMarkdown = `# ${cleanDocTitle}\n\n${finalMarkdown}`;
  }

  return finalMarkdown;
}

/**
 * Universal PDF parser that handles:
 * 1. ReportLab ASCII85 + Flate streams
 * 2. Standard Flate streams
 * 3. Uncompressed streams
 * 4. pdfjs-dist fallback
 */
export async function extractPdfText(buffer: Buffer, filename = 'document.pdf'): Promise<{
  text: string;
  pageCount: number;
  method: string;
}> {
  if (!buffer || buffer.length === 0) {
    throw new Error('PDF file is empty');
  }

  const rawLatin1 = buffer.toString('latin1');
  const streamRegex = /stream\s*([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  const allBlocks: string[] = [];
  let pagesFound = 0;

  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const streamContent = match[1].trim();
    let uncompressedBuffer: Buffer | null = null;

    // Check if it's ASCII85 encoded (ReportLab <~ ... ~> or starts with GatU / GasI)
    if (streamContent.includes('~>') || streamContent.startsWith('GatU') || streamContent.startsWith('GasI')) {
      try {
        const ascii85 = decodeAscii85(streamContent);
        uncompressedBuffer = zlib.inflateSync(ascii85);
      } catch {
        // Not ascii85+flate
      }
    }

    // Check if it's direct Flate/zlib compressed
    if (!uncompressedBuffer) {
      try {
        const rawBytes = Buffer.from(match[1], 'latin1');
        uncompressedBuffer = zlib.inflateSync(rawBytes);
      } catch {
        try {
          const rawBytes = Buffer.from(match[1], 'latin1');
          uncompressedBuffer = zlib.inflateRawSync(rawBytes);
        } catch {
          // not flate
        }
      }
    }

    if (uncompressedBuffer) {
      const streamText = uncompressedBuffer.toString('latin1');
      const blocks = extractTextFromPdfStream(streamText);
      if (blocks.length > 0) {
        pagesFound++;
        allBlocks.push(...blocks);
      }
    } else {
      const blocks = extractTextFromPdfStream(streamContent);
      if (blocks.length > 0) {
        pagesFound++;
        allBlocks.push(...blocks);
      }
    }
  }

  if (allBlocks.length > 0) {
    const structuredMarkdown = formatBlocksIntoMarkdown(filename, allBlocks);
    return {
      text: structuredMarkdown,
      pageCount: Math.max(1, pagesFound),
      method: 'pdf-stream-decoder',
    };
  }

  // Fallback to pdfjs-dist if stream decoding didn't find blocks
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item: any) => (item.str ? item.str.trim() : ''))
        .filter(Boolean);
      if (strings.length > 0) {
        pages.push(strings.join(' '));
      }
    }

    if (pages.length > 0) {
      const formatted = formatBlocksIntoMarkdown(filename, pages);
      return {
        text: formatted,
        pageCount: doc.numPages,
        method: 'pdfjs-dist',
      };
    }
  } catch (pdfjsErr) {
    console.warn('pdfjs-dist parsing attempt failed:', pdfjsErr);
  }

  throw new Error(
    'No readable text could be extracted from this PDF. Please verify that the PDF has selectable text.'
  );
}
