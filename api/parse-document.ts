/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import { extractPdfText, isRawPdfBinary } from './pdf-extractor';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
    return null;
  }
}

/**
 * Normalizes plain text extracted from documents into clean structured markdown with sections.
 */
function structurePlainTextIntoSections(title: string, rawText: string): string {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  const cleanLines: string[] = [];
  let foundFirstHeading = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (cleanLines.length > 0 && cleanLines[cleanLines.length - 1] !== '') {
        cleanLines.push('');
      }
      continue;
    }

    // Skip page numbers or standalone metadata noise
    if (/^(page\s+\d+(\s+of\s+\d+)?|\d+)$/i.test(line)) {
      continue;
    }

    // Detect if this line looks like a title or section header
    const isShort = line.length > 3 && line.length < 80;
    const isTitleCaseOrCaps =
      /^[A-Z0-9\s,:'"-]+$/.test(line) ||
      /^[A-Z][a-z0-9]+(\s+[A-Z0-9][a-z0-9]*)*:?$/.test(line);
    const noTrailingPunctuation = !/[.,;]$/.test(line);
    const isNumbered = /^(chapter|part|section|\d+(\.\d+)*)\s+/i.test(line);

    if (isShort && (isTitleCaseOrCaps || isNumbered) && noTrailingPunctuation) {
      if (!foundFirstHeading) {
        cleanLines.push(`# ${line}`);
        foundFirstHeading = true;
      } else {
        cleanLines.push(`## ${line}`);
      }
      cleanLines.push('');
    } else {
      cleanLines.push(line);
    }
  }

  let result = cleanLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // If no main heading was created, prepend the document title
  if (!result.startsWith('#')) {
    const cleanDocTitle = title.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    result = `# ${cleanDocTitle}\n\n${result}`;
  }

  return result;
}

export async function handleParseDocumentRequest(body: {
  filename: string;
  fileBase64?: string;
  mimeType?: string;
  rawText?: string;
}) {
  const { filename, fileBase64, mimeType, rawText } = body;
  const lowerName = filename.toLowerCase();

  // 1. Direct raw text (.md, .txt)
  if (rawText && !fileBase64) {
    if (isRawPdfBinary(rawText)) {
      throw new Error('Invalid file format: Detected raw binary data instead of text.');
    }
    return {
      filename,
      markdown: rawText,
      sourceType: 'text',
      wordCount: rawText.trim().split(/\s+/).filter(Boolean).length,
    };
  }

  const cleanBase64 = (fileBase64 || '').replace(/^data:.*?;base64,/, '').trim();
  const buffer = cleanBase64 ? Buffer.from(cleanBase64, 'base64') : Buffer.from('');
  const ai = getAiClient();

  // 2. PDF Documents (.pdf)
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    if (!cleanBase64) {
      throw new Error('PDF file upload was empty');
    }

    // Try Gemini Multimodal PDF Extraction first if available
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: cleanBase64,
                },
              },
              {
                text: 'Extract the full text content of this PDF document into clean, human-readable plain text with markdown headings (# for main title, ## for sections). Remove all header/footer artifacts, page numbers, and binary codes. Output only the clean document text.',
              },
            ],
          },
        });

        const geminiText = response.text || '';
        if (geminiText.trim().length > 30 && !isRawPdfBinary(geminiText)) {
          return {
            filename,
            markdown: geminiText.trim(),
            sourceType: 'pdf',
            method: 'gemini-3.8-flash',
            wordCount: geminiText.trim().split(/\s+/).filter(Boolean).length,
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini multimodal PDF parse failed, using stream extractor:', geminiErr);
      }
    }

    // Resilient server-side PDF stream extractor (handles ReportLab, ASCII85, Flate, pdfjs)
    try {
      const pdfResult = await extractPdfText(buffer);
      const structured = structurePlainTextIntoSections(filename, pdfResult.text);

      if (isRawPdfBinary(structured)) {
        throw new Error('Extracted PDF content contained binary stream markers.');
      }

      return {
        filename,
        markdown: structured,
        sourceType: 'pdf',
        method: pdfResult.method,
        pageCount: pdfResult.pageCount,
        wordCount: structured.trim().split(/\s+/).filter(Boolean).length,
      };
    } catch (parseErr: any) {
      console.error('PDF parsing error:', parseErr);
      throw new Error(
        parseErr?.message ||
          'Could not extract readable text from this PDF. Please verify the document contains selectable text.'
      );
    }
  }

  // 3. Word Documents (.docx, .doc)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc')
  ) {
    if (!cleanBase64) {
      throw new Error('Word document upload was empty');
    }

    try {
      // Use Mammoth for clean, authentic Word text extraction
      const mammothResult = await mammoth.extractRawText({ buffer });
      const rawWordText = mammothResult.value;

      if (!rawWordText || rawWordText.trim().length === 0) {
        throw new Error('Word document is empty or could not be converted');
      }

      const structured = structurePlainTextIntoSections(filename, rawWordText);
      return {
        filename,
        markdown: structured,
        sourceType: 'docx',
        wordCount: structured.trim().split(/\s+/).filter(Boolean).length,
      };
    } catch (docxErr: any) {
      console.warn('Mammoth Word extraction error, attempting fallback:', docxErr);

      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType:
                      mimeType ||
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    data: cleanBase64,
                  },
                },
                {
                  text: 'Extract the full text of this document into clean, readable text with markdown headings (#, ##).',
                },
              ],
            },
          });
          const text = response.text || '';
          if (text.trim().length > 20 && !isRawPdfBinary(text)) {
            return {
              filename,
              markdown: text.trim(),
              sourceType: 'docx',
              method: 'gemini-3.8-flash',
              wordCount: text.trim().split(/\s+/).filter(Boolean).length,
            };
          }
        } catch (geminiDocxErr) {
          console.error('Gemini Word parse error:', geminiDocxErr);
        }
      }

      throw new Error('Failed to extract text from Word document.');
    }
  }

  // 4. Text or Markdown files decoded from base64
  if (cleanBase64) {
    try {
      const decoded = buffer.toString('utf-8');
      // Validate that this is NOT a PDF or binary file disguised as text
      if (isRawPdfBinary(decoded)) {
        throw new Error(
          'This file appears to be a binary PDF or compiled document. Please ensure it is saved as valid text.'
        );
      }

      // Check for high percentage of binary characters
      const nonPrintableCount = (decoded.match(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g) || []).length;
      if (nonPrintableCount > decoded.length * 0.05) {
        throw new Error('This file contains binary or unreadable characters.');
      }

      const cleanText = decoded.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
      return {
        filename,
        markdown: cleanText,
        sourceType: 'text',
        wordCount: cleanText.trim().split(/\s+/).filter(Boolean).length,
      };
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to decode file contents as text.');
    }
  }

  throw new Error('Unsupported or empty file format.');
}

// Vercel Serverless Function export
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const result = await handleParseDocumentRequest(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to parse document' });
  }
}
