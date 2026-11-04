/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

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

export async function handleParseDocumentRequest(body: {
  filename: string;
  fileBase64?: string;
  mimeType?: string;
  rawText?: string;
}) {
  const { filename, fileBase64, mimeType, rawText } = body;

  // If raw text already provided (.md, .txt)
  if (rawText && !fileBase64) {
    return {
      filename,
      markdown: rawText,
      sourceType: 'text',
    };
  }

  const ai = getAiClient();

  // If it's a PDF file
  if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    if (fileBase64 && ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: fileBase64,
              },
            },
            {
              text: 'Extract the full text content of this PDF document into well-structured Markdown format. Preserve all section titles with appropriate Markdown headings (#, ##, ###), lists, tables, and code snippets. Do not add conversational commentary, just return the structured markdown document.',
            },
          ],
        });

        const markdown = response.text || '';
        return {
          filename,
          markdown,
          sourceType: 'pdf',
        };
      } catch (err) {
        console.warn('Gemini PDF extraction error, falling back:', err);
      }
    }
  }

  // If it's a Word .docx file or fallback for binary
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filename.toLowerCase().endsWith('.docx') ||
    filename.toLowerCase().endsWith('.doc')
  ) {
    if (fileBase64 && ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                // Gemini accepts standard document MIME types or octet-stream
                mimeType: mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                data: fileBase64,
              },
            },
            {
              text: 'Extract the full text of this Word document into clear, structured Markdown format with headings (#, ##), lists, and paragraphs. Return only the markdown without extra commentary.',
            },
          ],
        });

        return {
          filename,
          markdown: response.text || '',
          sourceType: 'docx',
        };
      } catch (err) {
        console.warn('Word document parsing error, falling back:', err);
      }
    }
  }

  // Fallback text decode from base64 if available
  if (fileBase64) {
    try {
      const decoded = Buffer.from(fileBase64, 'base64').toString('utf-8');
      // Strip binary non-printables
      const cleanText = decoded.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
      return {
        filename,
        markdown: cleanText,
        sourceType: 'fallback-text',
      };
    } catch {
      // ignore
    }
  }

  return {
    filename,
    markdown: `# ${filename}\n\nDocument uploaded successfully. Content will be indexed for search.`,
    sourceType: 'raw',
  };
}
