/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  Eye,
  RefreshCw,
  Layers,
  CheckCircle2,
  X,
  FileCheck,
  FileSpreadsheet,
  Info,
  Check,
  FileCode,
  FileUp,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Table, Column } from '../components/Table';
import { useToast } from '../components/Toast';
import { useDocStore } from '../lib/store';
import { chunkMarkdown, DocChunk, countWords } from '../lib/chunk';

// Utility to clean markdown formatting into pure plain text
function cleanToPlainText(raw: string): string {
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

export const KnowledgeBase: React.FC = () => {
  const store = useDocStore();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [previewChunk, setPreviewChunk] = useState<DocChunk | null>(null);
  const [previewMode, setPreviewMode] = useState<'plain' | 'source'>('plain');
  const [searchFilter, setSearchFilter] = useState('');

  const chunks = store.getChunks();

  // Convert File to Base64 for PDF and Word documents
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Process uploaded file (PDF, DOCX, DOC, MD, TXT)
  const handleProcessFile = async (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.md', '.markdown', '.txt', '.pdf', '.docx', '.doc'];

    if (!allowed.includes(ext) && !file.type.includes('text') && !file.type.includes('pdf')) {
      toast.warning('Please upload a supported file: PDF (.pdf), Word (.docx), Markdown (.md), or Text (.txt).');
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingStatus(`Reading and extracting text from ${file.name}...`);
      toast.info(`Parsing ${file.name}...`);

      let markdownContent = '';

      if (ext === '.pdf' || ext === '.docx' || ext === '.doc') {
        const base64 = await fileToBase64(file);
        setProcessingStatus(`Decoding ${ext.toUpperCase()} document pages into plain text...`);

        const parseRes = await fetch('/api/parse-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            fileBase64: base64,
            mimeType: file.type,
          }),
        });

        if (!parseRes.ok) {
          const errData = await parseRes.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to extract readable text from ${file.name}`);
        }

        const parseData = await parseRes.json();
        markdownContent = parseData.markdown || '';
      } else {
        // Plain text / Markdown
        markdownContent = await file.text();
      }

      if (!markdownContent.trim()) {
        toast.warning('No text content could be extracted from this file.');
        setIsProcessing(false);
        setProcessingStatus('');
        return;
      }

      // Step 2: Break into logical readable sections (~500 tokens / 380 words)
      setProcessingStatus('Organizing into readable document sections...');
      const generatedChunks = chunkMarkdown(file.name, markdownContent, 500, 50);

      if (generatedChunks.length === 0) {
        toast.warning('Unable to create sections from file.');
        setIsProcessing(false);
        setProcessingStatus('');
        return;
      }

      // Step 3: Embed chunks for semantic search
      setProcessingStatus(`Indexing ${generatedChunks.length} sections for fast search...`);
      try {
        const embedRes = await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: generatedChunks.map((c) => `${c.heading}\n${c.content}`) }),
        });

        if (embedRes.ok) {
          const embedData = await embedRes.json();
          if (embedData.embeddings && embedData.embeddings.length > 0) {
            generatedChunks.forEach((c, idx) => {
              c.embedding = embedData.embeddings[idx];
            });
          }
        }
      } catch (embedErr) {
        console.warn('Embedding step using fallback indexing:', embedErr);
      }

      // Add to store
      store.addChunks(generatedChunks);
      toast.success(
        `Added ${generatedChunks.length} searchable section${
          generatedChunks.length > 1 ? 's' : ''
        } from ${file.name} to your Document Library!`
      );
    } catch (err: any) {
      console.error('File processing error:', err);
      toast.error(err.message || 'Failed to process document.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const loadSampleDoc = (title: string, markdown: string) => {
    const file = new File([markdown], title, { type: 'text/markdown' });
    handleProcessFile(file);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset document library to starter sample documentation?')) {
      store.resetChunksToDefault();
      toast.info('Document library reset to starter docs.');
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear all documents from library? You can upload your own PDF, Word, or Markdown files.')) {
      store.setChunks([]);
      toast.info('Document library cleared. Ready for your files.');
    }
  };

  const filteredChunks = chunks.filter(
    (c) =>
      c.file.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.heading.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.content.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const columns: Column<DocChunk>[] = [
    {
      header: 'Document File',
      accessorKey: 'file',
      width: '22%',
      cell: (row) => {
        const isPdf = row.file.toLowerCase().endsWith('.pdf');
        const isDocx = row.file.toLowerCase().endsWith('.docx') || row.file.toLowerCase().endsWith('.doc');
        return (
          <div className="flex items-center gap-2 truncate">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                isPdf
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : isDocx
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {isPdf ? 'PDF' : isDocx ? 'Word' : 'Text'}
            </span>
            <span className="text-xs font-medium text-slate-800 truncate" title={row.file}>
              {row.file}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Section Title',
      accessorKey: 'heading',
      width: '25%',
      cell: (row) => (
        <span className="font-semibold text-slate-900 text-xs truncate block" title={row.heading}>
          {row.heading}
        </span>
      ),
    },
    {
      header: 'Length',
      accessorKey: 'tokens',
      width: '13%',
      cell: (row) => {
        const words = row.wordCount || Math.round(row.tokens / 1.3);
        return (
          <span className="text-xs text-slate-600 font-medium">
            ~{words} words
          </span>
        );
      },
    },
    {
      header: 'Text Preview (Plain Text)',
      accessorKey: 'content',
      width: '30%',
      cell: (row) => {
        const plain = cleanToPlainText(row.content);
        return (
          <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {plain}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      width: '10%',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPreviewChunk(row)}
            className="p-1.5 text-slate-400 hover:text-[#00A3A1] hover:bg-teal-50 rounded transition-colors cursor-pointer"
            title="Read section text"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              store.deleteChunk(row.id);
              toast.info(`Removed section from document library`);
            }}
            className="p-1.5 text-slate-400 hover:text-[#D64545] hover:bg-red-50 rounded transition-colors cursor-pointer"
            title="Delete section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
            Document Library
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Upload your PDF, Word, and text documents. DocPilot turns them into clean plain text and makes them searchable in &ldquo;Ask your Documents&rdquo;.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClearAll}
            icon={<Trash2 className="w-3.5 h-3.5 text-slate-400" />}
          >
            Clear Library
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleResetDefaults}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Reset Starter Docs
          </Button>
        </div>
      </div>

      {/* Simple explainer box for non-technical writers */}
      <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 text-xs text-slate-700 space-y-2">
        <div className="flex items-center gap-2 text-teal-900 font-semibold text-sm">
          <Info className="w-4 h-4 text-[#00A3A1] shrink-0" />
          <span>How your document library works:</span>
        </div>
        <p className="leading-relaxed">
          • <strong>Upload any document:</strong> Drag and drop a <strong>PDF (.pdf)</strong>, <strong>Word document (.docx)</strong>, or <strong>Text/Markdown file (.txt, .md)</strong> below.
          <br />
          • <strong>Clean plain text extraction:</strong> DocPilot automatically removes confusing PDF binary codes, headers, and slashes so that all text is clean and easy to read.
          <br />
          • <strong>Search immediately:</strong> Once uploaded, go to <strong>&ldquo;Ask your Documents&rdquo;</strong> to ask any question and get answers citing your exact files!
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Sections Indexed
            </div>
            <div className="text-2xl font-bold text-[#0B1F3A] mt-1">
              {chunks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#00A3A1] flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Search Readiness
            </div>
            <div className="text-2xl font-bold text-[#2E9E6B] mt-1 flex items-center gap-1.5">
              <span>Ready</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#2E9E6B] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Supported Files
            </div>
            <div className="text-xs font-semibold text-slate-800 mt-1">
              PDF &bull; Word (.docx) &bull; Markdown &bull; Text
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone Supporting PDF, Word, Markdown, Text */}
      <Card padding="md" className="border-[#E2E8F0] shadow-xs">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            isDragging
              ? 'border-[#00A3A1] bg-teal-50/50'
              : 'border-[#E2E8F0] hover:border-slate-300 bg-slate-50/40'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleProcessFile(e.target.files[0]);
              }
            }}
            accept=".md,.markdown,.txt,.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/markdown"
            className="hidden"
          />

          <div className="w-12 h-12 mx-auto rounded-full bg-teal-50 text-[#00A3A1] flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="text-base font-semibold text-[#0B1F3A]">
            Upload your document files
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
            Drag and drop <strong>PDF (.pdf)</strong>, <strong>Word (.docx)</strong>, <strong>Markdown (.md)</strong>, or <strong>Text (.txt)</strong> documents here.
          </p>

          {isProcessing && processingStatus && (
            <div className="mt-3 p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-medium text-teal-900 inline-block">
              {processingStatus}
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              variant="primary"
              isLoading={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              icon={<UploadCloud className="w-4 h-4" />}
              className="font-medium px-5"
            >
              Select File to Upload
            </Button>
          </div>
        </div>

        {/* Quick sample loader pills */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Or test with starter samples:</span>
          <button
            onClick={() =>
              loadSampleDoc(
                'clear-explanations-guide.md',
                `# The Art of Explaining Complex Things Simply\n\nSome of the most useful explanations are also the simplest. A person who understands a subject deeply should be able to guide someone else through it without making it feel more difficult than necessary.\n\n## Principle 1: Start with the Reader\n\nBegin by identifying what the reader already knows and what they actually need to accomplish.\n\n## Principle 2: Use Plain Language\n\nAvoid acronyms, jargon, and passive phrasing whenever simple conversational words work.`
              )
            }
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            + Add Clear Explanations Guide (.md)
          </button>
          <button
            onClick={() =>
              loadSampleDoc(
                'webhooks-guide.md',
                `# Webhook Architecture\n\nDocPilot transmits real-time event notifications via HTTP POST to registered endpoints.\n\n## Delivery Guarantees\n\nDeliveries are at-least-once. Endpoints must return 200 OK within 5 seconds.\n\n## Security and Signatures\n\nAll webhook payloads are signed with HMAC SHA-256 in the X-Signature header.`
              )
            }
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            + Add Webhooks Guide (.md)
          </button>
        </div>
      </Card>

      {/* Table of Chunks */}
      <Card
        padding="none"
        title={`Indexed Document Sections (${filteredChunks.length})`}
        subtitle="These sections are searched when you ask questions in Tab 1"
        headerAction={
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search sections..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 px-3 text-xs rounded-md border border-[#E2E8F0] focus:outline-none focus:border-[#00A3A1]"
            />
          </div>
        }
      >
        <Table
          data={filteredChunks}
          columns={columns}
          keyExtractor={(row) => row.id}
          emptyState={
            <div className="py-12 text-center text-slate-500 text-sm">
              {chunks.length === 0
                ? 'Your document library is empty. Upload your PDF, Word, or Markdown files above or click "Reset Starter Docs".'
                : `No sections match "${searchFilter}".`}
            </div>
          }
        />
      </Card>

      {/* Section Inspection Modal */}
      {previewChunk && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-semibold text-[#0B1F3A] text-base">
                  {previewChunk.heading}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Source Document: <span className="font-medium text-slate-700">{previewChunk.file}</span> &bull; Length: ~{previewChunk.wordCount || Math.round(previewChunk.tokens / 1.3)} words
                </div>
              </div>
              <button
                onClick={() => setPreviewChunk(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3 bg-slate-50/70 border-b border-[#E2E8F0] flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 uppercase tracking-wider">
                Section Content
              </span>
              <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded">
                <button
                  type="button"
                  onClick={() => setPreviewMode('plain')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    previewMode === 'plain'
                      ? 'bg-white shadow-xs font-semibold text-slate-900'
                      : 'text-slate-600'
                  }`}
                >
                  Plain Text View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('source')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    previewMode === 'source'
                      ? 'bg-white shadow-xs font-semibold text-slate-900'
                      : 'text-slate-600'
                  }`}
                >
                  Raw Markdown
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {previewMode === 'plain' ? (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                  {cleanToPlainText(previewChunk.content)}
                </div>
              ) : (
                <pre className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap">
                  {previewChunk.content}
                </pre>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-[#E2E8F0] flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setPreviewChunk(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
