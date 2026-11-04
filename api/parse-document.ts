/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import { extractPdfText } from './pdf-extractor';
import { isCorruptOrBinaryText } from '../src/lib/cleanText';

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
 * Dynamically converts any original file name into a clean Markdown filename (.md).
 * Works for any arbitrary document name without hardcoding.
 */
function toMarkdownFilename(originalName: string): string {
  const baseName = originalName
    .replace(/\.[^/.]+$/, '') // remove extension
    .trim();
  return `${baseName || 'document'}.md`;
}

/**
 * Normalizes plain text extracted from documents into clean structured markdown with sections.
 */
function structurePlainTextIntoSections(docTitle: string, rawText: string): string {
  const cleanTitle = docTitle
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .trim();

  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\ufffd/g, '') // strip any unicode replacement diamonds
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

    // Skip page numbers or standalone page headers
    if (/^(page\s+\d+(\s+of\s+\d+)?|\d+)$/i.test(line)) {
      continue;
    }

    // Detect if this line looks like a title or section header
    const isShort = line.length > 3 && line.length < 80;
    const isTitleCaseOrCaps =
      /^[A-Z0-9\s,:'"-]+$/.test(line) ||
      /^[A-Z][a-z0-9]+(\s+[A-Z0-9][a-z0-9]*)*:?$/.test(line);
    const noTrailingPunctuation = !/[.,;]$/.test(line);
    const isNumbered = /^(chapter|part|section|principle|\d+(\.\d+)*)\s+/i.test(line);

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
    result = `# ${cleanTitle}\n\n${result}`;
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

  const cleanBase64 = (fileBase64 || '').replace(/^data:.*?;base64,/, '').trim();
  const buffer = cleanBase64 ? Buffer.from(cleanBase64, 'base64') : Buffer.from('');
  const ai = getAiClient();
  const targetMdFilename = toMarkdownFilename(filename);

  // 1. Direct Markdown file (.md, .markdown)
  if ((lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) && (rawText || cleanBase64)) {
    const text = rawText || buffer.toString('utf-8');
    if (isCorruptOrBinaryText(text)) {
      throw new Error('This file appears to contain corrupt binary symbols instead of valid Markdown text.');
    }
    return {
      filename,
      markdown: text,
      sourceType: 'markdown',
      isConverted: false,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
    };
  }

  // Check if buffer starts with PDF magic bytes (%PDF) even if filename extension differs
  const isPdfFile =
    mimeType === 'application/pdf' ||
    lowerName.endsWith('.pdf') ||
    buffer.slice(0, 5).toString('latin1').startsWith('%PDF');

  // 2. Convert PDF to Markdown
  if (isPdfFile) {
    if (!cleanBase64) {
      throw new Error('PDF file upload was empty.');
    }

    // Try Gemini Multimodal PDF Conversion if API key is active
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
                text: 'Convert the full text content of this PDF into a clean, well-structured Markdown (.md) document with # for document title, ## for section headings, and clean paragraphs. Strip all headers, footers, page numbers, and binary PDF artifacts. Return only the markdown document text without commentary.',
              },
            ],
          },
        });

        const geminiText = response.text || '';
        if (geminiText.trim().length > 30 && !isCorruptOrBinaryText(geminiText)) {
          return {
            filename: targetMdFilename,
            originalFilename: filename,
            markdown: geminiText.trim(),
            sourceType: 'markdown',
            convertedFrom: 'pdf',
            isConverted: true,
            method: 'gemini-3.8-flash',
            wordCount: geminiText.trim().split(/\s+/).filter(Boolean).length,
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini multimodal PDF conversion attempt failed, using stream decoder:', geminiErr);
      }
    }

    // Server-side PDF stream extractor (handles ReportLab ASCII85, Flate, text operators)
    try {
      const pdfResult = await extractPdfText(buffer, filename);
      const structuredMarkdown = structurePlainTextIntoSections(filename, pdfResult.text);

      if (isCorruptOrBinaryText(structuredMarkdown)) {
        throw new Error('Extracted PDF content contained binary stream markers.');
      }

      return {
        filename: targetMdFilename,
        originalFilename: filename,
        markdown: structuredMarkdown,
        sourceType: 'markdown',
        convertedFrom: 'pdf',
        isConverted: true,
        method: pdfResult.method,
        pageCount: pdfResult.pageCount,
        wordCount: structuredMarkdown.trim().split(/\s+/).filter(Boolean).length,
      };
    } catch (parseErr: any) {
      console.error('PDF parsing error:', parseErr);
      throw new Error(
        parseErr?.message ||
          'Could not extract readable text from this PDF. Please verify that the PDF contains selectable text.'
      );
    }
  }

  // 3. Convert Word Document (.docx, .doc) to Markdown
  const isWordFile =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc');

  if (isWordFile) {
    if (!cleanBase64) {
      throw new Error('Word document upload was empty.');
    }

    try {
      const mammothResult = await mammoth.extractRawText({ buffer });
      const rawWordText = mammothResult.value;

      if (!rawWordText || rawWordText.trim().length === 0) {
        throw new Error('Word document is empty or could not be read.');
      }

      const structuredMarkdown = structurePlainTextIntoSections(filename, rawWordText);
      return {
        filename: targetMdFilename,
        originalFilename: filename,
        markdown: structuredMarkdown,
        sourceType: 'markdown',
        convertedFrom: 'word',
        isConverted: true,
        wordCount: structuredMarkdown.trim().split(/\s+/).filter(Boolean).length,
      };
    } catch (docxErr: any) {
      console.error('Word extraction error:', docxErr);
      throw new Error('Failed to extract text from Word document.');
    }
  }

  // 4. Convert Plain Text (.txt) or Base64 Text into Markdown
  if (cleanBase64 || rawText) {
    let textContent = rawText || '';
    if (!textContent && cleanBase64) {
      textContent = buffer.toString('utf-8');
    }

    if (isCorruptOrBinaryText(textContent)) {
      throw new Error(
        'This file appears to contain binary symbols or corrupted characters. Please ensure it is a valid text file.'
      );
    }

    const structuredMarkdown = structurePlainTextIntoSections(filename, textContent);
    return {
      filename: targetMdFilename,
      originalFilename: filename,
      markdown: structuredMarkdown,
      sourceType: 'markdown',
      convertedFrom: 'text',
      isConverted: true,
      wordCount: structuredMarkdown.trim().split(/\s+/).filter(Boolean).length,
    };
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
    return res.status(500).json({ error: err?.message || 'Failed to convert document to Markdown' });
  }
}
