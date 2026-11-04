/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Validates whether a text string contains raw binary PDF artifacts.
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
 * Strips raw markdown syntax, escape slashes, bracketed links, and formatting symbols
 * to produce clean, natural human-readable plain text for non-technical readers.
 */
export function cleanToPlainText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^#{1,6}\s+(.*)$/gm, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[a-z]*\n([\s\S]*?)```/gi, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\s*\d+\s*\]/g, '')
    .replace(/\\([()[\]\\/`*_#+-])/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\|\s*[-:]+[-|\s:]*\|/g, '')
    .replace(/\|/g, ' ')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
