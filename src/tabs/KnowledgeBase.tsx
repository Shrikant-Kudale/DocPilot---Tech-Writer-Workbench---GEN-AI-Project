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
  HelpCircle,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Table, Column } from '../components/Table';
import { useToast } from '../components/Toast';
import { useDocStore } from '../lib/store';
import { chunkMarkdown, DocChunk } from '../lib/chunk';

export const KnowledgeBase: React.FC = () => {
  const store = useDocStore();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetTokens, setTargetTokens] = useState(500);
  const [overlapTokens, setOverlapTokens] = useState(50);
  const [previewChunk, setPreviewChunk] = useState<DocChunk | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const chunks = store.getChunks();

  // Convert File to Base64 for PDF and Word documents
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime;base64, prefix
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
      toast.info(`Parsing and analyzing ${file.name}...`);

      let markdownContent = '';

      if (ext === '.pdf' || ext === '.docx' || ext === '.doc') {
        const base64 = await fileToBase64(file);
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
          throw new Error(`Failed to parse ${ext.toUpperCase()} document`);
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
        return;
      }

      // Step 2: Break into smart readable chunks (~500 tokens with 50-token overlap)
      const generatedChunks = chunkMarkdown(file.name, markdownContent, targetTokens, overlapTokens);

      if (generatedChunks.length === 0) {
        toast.warning('Unable to create sections from file.');
        setIsProcessing(false);
        return;
      }

      // Step 3: Embed chunks with Gemini
      toast.info(`Indexing ${generatedChunks.length} sections into your searchable knowledge base...`);
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

      // Add to store
      store.addChunks(generatedChunks);
      toast.success(
        `Added ${generatedChunks.length} searchable section${generatedChunks.length > 1 ? 's' : ''} from ${file.name} to your Knowledge Base!`
      );
    } catch (err: any) {
      console.error('File processing error:', err);
      toast.error(err.message || 'Failed to process document.');
    } finally {
      setIsProcessing(false);
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
    if (confirm('Reset knowledge base to starter technical documentation?')) {
      store.resetChunksToDefault();
      toast.info('Knowledge base reset to seed documentation.');
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear all documents from knowledge base? You can upload your own files to build it from scratch.')) {
      store.setChunks([]);
      toast.info('Knowledge base cleared. Ready for your custom files.');
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
      header: 'File',
      accessorKey: 'file',
      width: '20%',
      cell: (row) => {
        const isPdf = row.file.toLowerCase().endsWith('.pdf');
        const isDocx = row.file.toLowerCase().endsWith('.docx') || row.file.toLowerCase().endsWith('.doc');
        return (
          <div className="flex items-center gap-1.5 truncate">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                isPdf
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : isDocx
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isPdf ? 'PDF' : isDocx ? 'DOC' : 'MD'}
            </span>
            <span className="font-mono text-xs text-slate-800 truncate" title={row.file}>
              {row.file}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Section Title',
      accessorKey: 'heading',
      width: '26%',
      cell: (row) => (
        <span className="font-semibold text-slate-900 text-xs">
          {row.heading}
        </span>
      ),
    },
    {
      header: 'Words / Tokens',
      accessorKey: 'tokens',
      width: '12%',
      cell: (row) => (
        <span className="text-xs font-mono text-slate-500">
          ~{row.tokens}
        </span>
      ),
    },
    {
      header: 'Text Preview',
      accessorKey: 'content',
      width: '32%',
      cell: (row) => (
        <div className="text-xs text-slate-600 line-clamp-2">
          {row.content}
        </div>
      ),
    },
    {
      header: 'Actions',
      width: '10%',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPreviewChunk(row)}
            className="p-1.5 text-slate-400 hover:text-[#00A3A1] hover:bg-teal-50 rounded transition-colors cursor-pointer"
            title="View section text"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              store.deleteChunk(row.id);
              toast.info(`Removed section from knowledge base`);
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
            Knowledge Base
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            The documentation repository that powers search in &ldquo;Ask the Docs&rdquo;. Upload your files to expand the library.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClearAll}
            icon={<Trash2 className="w-3.5 h-3.5 text-slate-400" />}
          >
            Clear All
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

      {/* Explainer Box: Plain English explanation of how knowledge base is generated */}
      <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-700 space-y-2">
        <div className="flex items-center gap-2 text-teal-900 font-semibold text-sm">
          <Info className="w-4 h-4 text-[#00A3A1] shrink-0" />
          <span>How your Knowledge Base is generated:</span>
        </div>
        <p className="leading-relaxed">
          <strong>1. Where does the data come from?</strong> Right now, DocPilot has <strong>starter sample documentation</strong> pre-loaded (API authentication, webhooks, and rate limits) so you can test it immediately.
        </p>
        <p className="leading-relaxed">
          <strong>2. What happens when you upload files?</strong> When you upload a <strong>PDF, Word (.docx), Markdown (.md), or Text (.txt)</strong> file below, DocPilot extracts the text, breaks it into logical sections, and adds them to your active knowledge base. Your questions in &ldquo;Ask the Docs&rdquo; will immediately search across these newly added files!
        </p>
      </div>

      {/* Summary KPI Cards */}
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
              Search Status
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
              Accepted Formats
            </div>
            <div className="text-xs font-semibold text-slate-800 mt-1">
              PDF &bull; Word &bull; Markdown &bull; TXT
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone Supporting PDF, Word, Markdown, Text */}
      <Card padding="md">
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
            Upload your documentation files
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Drag and drop <strong>PDF (.pdf)</strong>, <strong>Word (.docx)</strong>, <strong>Markdown (.md)</strong>, or <strong>Text (.txt)</strong> documents here.
          </p>

          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              variant="primary"
              isLoading={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              icon={<UploadCloud className="w-4 h-4" />}
            >
              Select File to Upload
            </Button>
          </div>
        </div>

        {/* Quick sample loader pills */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Or test with starter docs:</span>
          <button
            onClick={() =>
              loadSampleDoc(
                'webhooks-guide.md',
                `# Webhook Architecture\n\nDocPilot transmits real-time event notifications via HTTP POST to registered endpoints.\n\n## Delivery Guarantees\n\nDeliveries are at-least-once. Endpoints must return 200 OK within 5 seconds.\n\n## Security and Signatures\n\nAll webhook payloads are signed with HMAC SHA-256 in the X-Signature header.`
              )
            }
            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            + Add Webhooks Guide (.md)
          </button>
          <button
            onClick={() =>
              loadSampleDoc(
                'oauth-pkce.md',
                `# OAuth 2.0 PKCE Authorization\n\nSingle-page applications must use Authorization Code Flow with Proof Key for Code Exchange (PKCE).\n\n## Code Verifier\n\nGenerate a random 43-128 character URL-safe string.\n\n## Code Challenge\n\nBase64URL-encode the SHA-256 hash of the verifier.`
              )
            }
            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            + Add OAuth PKCE Guide (.md)
          </button>
        </div>
      </Card>

      {/* Table of Chunks */}
      <Card
        padding="none"
        title={`Active Knowledge Base Sections (${filteredChunks.length})`}
        subtitle="These sections are searched when asking questions in Tab 1"
        headerAction={
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search sections..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 px-3 text-xs rounded border border-[#E2E8F0] focus:outline-none focus:border-[#00A3A1]"
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
                ? 'Knowledge Base is empty. Upload your PDF, Word, or Markdown files above or click "Reset Starter Docs".'
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
                  Source: <span className="font-mono font-semibold">{previewChunk.file}</span> | Tokens: ~{previewChunk.tokens}
                </div>
              </div>
              <button
                onClick={() => setPreviewChunk(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Section Content
                </label>
                <pre className="mt-1.5 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap">
                  {previewChunk.content}
                </pre>
              </div>
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
