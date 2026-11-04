/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks whether text contains raw PDF binary bytes, replacement question marks (\ufffd),
 * stream codes, or non-human symbol gibberish.
 */
export function isCorruptOrBinaryText(text: string): boolean {
  if (!text || typeof text !== 'string') return true;

  // 1. Replacement character (\ufffd) check - question mark diamonds from failed UTF-8 decodes
  if (text.includes('\ufffd')) return true;

  // 2. Raw PDF binary & structural keywords check across the entire text
  if (
    /%PDF-|\/MediaBox|\/Contents|\/FlateDecode|\/ASCII85Decode|ReportLab Generated|endobj|trailer <<|startxref|\bstream\b|\bendstream\b|\/Type\s*\/Page|\/ProcSet|\/FontFile/i.test(
      text
    )
  ) {
    return true;
  }

  // 3. High concentration of non-printable or control characters
  const controlChars = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g);
  if (controlChars && controlChars.length > text.length * 0.01) {
    return true;
  }

  // 4. Human text verification: In genuine Markdown/English text, at least 65% of characters must be standard letters, numbers, spaces, and punctuation
  if (text.length > 50) {
    const readableChars = text.match(/[a-zA-Z0-9\s.,!?'"()\-:;#*`]/g);
    const ratio = readableChars ? readableChars.length / text.length : 0;
    if (ratio < 0.65) {
      return true;
    }
  }

  return false;
}

/**
 * Converts any Markdown text or AI response into 100% pure, human-readable plain text.
 * Strips all special markdown icons, heading hashes (#), bold/italic asterisks (*),
 * code backticks (`), brackets ([]), escape slashes (\, /), table pipes (|),
 * list dashes (- ), bullet dots (•), em/en dashes, clustered commas, and AI preamble artifacts.
 * The resulting prose reads naturally aloud without pronouncing punctuation symbols.
 */
export function markdownToPurePlainText(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. Strip AI preambles and boilerplate patterns
  text = text
    .replace(/^Based on Overview in [^:\n]+:\s*/im, '')
    .replace(/Refer to \[[^\]]+\] for the full section text[^\n]*/gi, '')
    .replace(/^ANSWER IN (?:PURE )?(?:PLAIN )?(?:TEXT|ENGLISH):\s*/im, '')
    .replace(/^Here is the (?:plain text )?answer:\s*/im, '')
    .replace(/^(?:As an AI|In plain text:)\s*/im, '');

  // 2. Strip HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // 3. Strip code blocks with backticks
  text = text
    .replace(/```[a-z0-9_-]*\n([\s\S]*?)```/gi, '$1')
    .replace(/```/g, '')
    .replace(/`([^`]+)`/g, '$1');

  // 4. Strip headings (#, ##, ###)
  text = text.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // 5. Strip bold & italics (**text**, *text*, __text__, _text_, ~~text~~)
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1');

  // 6. Strip markdown links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 7. Strip citation link brackets [1], [2], [citation], [source]
  text = text.replace(/\[\s*[\d\w_-]+\s*\]/g, '');

  // 8. Strip standalone square brackets
  text = text.replace(/[\[\]]/g, '');

  // 9. Strip backslash escapes (\, \/, \-, \*)
  text = text
    .replace(/\\([()[\]\\/`*_#+-])/g, '$1')
    .replace(/\\/g, '');

  // 10. Standardize HTML entities
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&bull;/g, '')
    .replace(/&mdash;|&ndash;/g, ', ');

  // 11. Strip markdown table formatting (pipes and separator lines)
  text = text
    .replace(/\|\s*[-:]+[-|\s:]*\|/g, '')
    .replace(/\|/g, ' ');

  // 12. Strip horizontal divider rules (---, ===, ___)
  text = text.replace(/^\s*[-=_~]{2,}\s*$/gm, '');

  // 13. Strip leading bullet markers (- Item, * Item, + Item, • Item, — Item, – Item)
  // Replaces leading list symbols so speech synthesizers / readers don't read "dash" or "bullet"
  text = text.replace(/^[\s\t]*[-*+•—–]\s+/gm, '');

  // 14. Convert spaced dashes ( — , – , - ) in mid-sentence to a clean natural comma pause
  // Retains internal hyphens like "step-by-step" or "non-technical"
  text = text.replace(/\s+[—–-]{1,3}\s+/g, ', ');

  // 15. Remove blockquote arrows (> quote)
  text = text.replace(/^\s*>\s*/gm, '');

  // 16. Clean up comma formatting and weird punctuation clusters
  text = text
    .replace(/,{2,}/g, ',') // Collapse double/triple commas (,, -> ,)
    .replace(/\s+,/g, ',') // Remove leading space before comma (" ," -> ",")
    .replace(/,\s*([.?!;])/g, '$1') // Remove comma directly followed by period or question mark (",." -> ".")
    .replace(/,\s*$/gm, '.') // Replace dangling comma at end of line with a clean period
    .replace(/[ \t]{2,}/g, ' ') // Collapse multiple spaces
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive blank lines
    .trim();

  // 17. Ensure no trailing dangling comma at the end of the text
  if (text.endsWith(',')) {
    text = text.slice(0, -1).trim() + '.';
  }

  return text;
}
