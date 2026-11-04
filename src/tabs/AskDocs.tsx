/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  AlertTriangle,
  FileText,
  ExternalLink,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toast';
import { useDocStore } from '../lib/store';
import { rankChunks, textToVectorFallback, ScoredChunk } from '../lib/similarity';

interface AskDocsProps {
  onNavigateToTab?: (tabId: string) => void;
}

export const AskDocs: React.FC<AskDocsProps> = ({ onNavigateToTab }) => {
  const store = useDocStore();
  const toast = useToast();

  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [matchedChunks, setMatchedChunks] = useState<ScoredChunk[]>([]);
  const [topSimilarity, setTopSimilarity] = useState<number | null>(null);
  const [isBelowThreshold, setIsBelowThreshold] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<ScoredChunk | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);

  const sampleQuestions = [
    'How do I authenticate API requests?',
    'What is the webhook retry policy for failed deliveries?',
    'What are the default rate limits for Tier 1 accounts?',
    'How do I verify webhook HMAC signatures in Python?',
    'Can I use GraphQL subscriptions on edge workers?', // Known gap to test fallback!
  ];

  const handleAsk = async (queryToAsk?: string) => {
    const q = (queryToAsk !== undefined ? queryToAsk : question).trim();
    if (!q) {
      toast.warning('Please enter a documentation query.');
      return;
    }

    if (queryToAsk !== undefined) {
      setQuestion(q);
    }

    setIsLoading(true);
    setAnswer(null);
    setMatchedChunks([]);
    setIsBelowThreshold(false);
    setTopSimilarity(null);

    try {
      const allChunks = store.getChunks();
      if (allChunks.length === 0) {
        toast.error('Knowledge Base is empty. Upload docs or reset defaults in Knowledge Base tab.');
        setIsLoading(false);
        return;
      }

      // Step 1: Obtain query embedding from server
      let queryEmbedding: number[] = [];
      try {
        const embedRes = await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: q }),
        });
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          if (embedData.embeddings && embedData.embeddings[0]) {
            queryEmbedding = embedData.embeddings[0];
          }
        }
      } catch (err) {
        console.warn('API embed query failed, using local projection fallback', err);
      }

      if (queryEmbedding.length === 0) {
        queryEmbedding = textToVectorFallback(q);
      }

      // Step 2: Rank chunks via cosine similarity
      const SIMILARITY_THRESHOLD = 0.55;
      const { ranked, topSimilarity: maxSim, hasMatch } = rankChunks(
        queryEmbedding,
        allChunks,
        SIMILARITY_THRESHOLD
      );

      setTopSimilarity(maxSim);

      if (!hasMatch || maxSim < SIMILARITY_THRESHOLD) {
        // Fallback: below 0.55 threshold -> show amber card and log to gap report!
        setIsBelowThreshold(true);
        store.logGap(q, maxSim);
        toast.warning(
          `No high-confidence match found (Top similarity: ${(maxSim * 100).toFixed(1)}% < 55%). Logged as documentation gap.`,
          'Doc Gap Detected'
        );
        setIsLoading(false);
        return;
      }

      // Top matches (take top 3)
      const topContextChunks = ranked.slice(0, 3);
      setMatchedChunks(topContextChunks);

      // Step 3: Call serverless /api/chat for RAG answer with citations
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rag_answer',
          question: q,
          contextChunks: topContextChunks.map((c) => ({
            citationIndex: c.citationIndex || 1,
            file: c.file,
            heading: c.heading,
            content: c.content,
          })),
        }),
      });

      if (!chatRes.ok) {
        throw new Error('Failed to retrieve AI answer from /api/chat');
      }

      const chatData = await chatRes.json();
      setAnswer(chatData.answer);
      toast.success('Generated answer with verified source citations.');
    } catch (err: any) {
      console.error('Ask docs error:', err);
      toast.error(err.message || 'An error occurred while querying documentation.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAnswer = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    toast.success('Answer copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
          Ask the Docs
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Ask any question about your documentation. Answers are backed by numbered source citations linking directly to your uploaded files.
        </p>
      </div>

      {/* Friendly How this works explainer */}
      <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-700 space-y-1">
        <div className="font-semibold text-teal-900 flex items-center gap-1.5">
          <span>💡 How to use & what happens:</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          <strong>1. Ask a question:</strong> Enter your question below or click a quick sample chip.
          <br />
          <strong>2. Search & Citation:</strong> The system finds the exact sections in your Knowledge Base and cites them with numbers like <span className="font-bold text-teal-700">[1]</span> and <span className="font-bold text-teal-700">[2]</span>.
          <br />
          <strong>3. If not found:</strong> If the question isn&apos;t covered in your uploaded files, it warns you and logs it to the <strong>Gap Report</strong> so your team knows what to write.
        </p>
      </div>

      {/* Query Search Card */}
      <Card padding="md" className="border-[#E2E8F0]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask any technical question (e.g. 'How do I authenticate API requests?')..."
                className="w-full h-10 pl-11 pr-4 rounded-[8px] border border-[#E2E8F0] bg-white text-sm text-[#1B2733] placeholder-slate-400 focus:outline-none focus:border-[#00A3A1] focus:ring-2 focus:ring-[#00A3A1]/20 transition-all"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              icon={<Sparkles className="w-4 h-4" />}
              className="shrink-0 font-semibold"
            >
              Ask Docs
            </Button>
          </div>

          {/* Quick sample chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-500 font-medium">Try asking:</span>
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAsk(sq)}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-teal-50 hover:text-[#00A3A1] hover:border-teal-200 border border-slate-200 text-slate-600 transition-colors text-left cursor-pointer"
              >
                {sq}
              </button>
            ))}
          </div>
        </form>
      </Card>

      {/* Fallback Warning Card: If Top Similarity < 0.55 */}
      {isBelowThreshold && (
        <Card
          borderVariant="warning"
          padding="md"
          className="bg-amber-50/50 border-amber-300 animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-[#F2A900] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#b07b00]" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-amber-900">
                  Not found in docs
                </h3>
                <Badge variant="warning" size="sm">
                  Threshold &lt; 0.55
                </Badge>
              </div>
              <p className="text-sm text-amber-800 leading-relaxed">
                The highest semantic similarity found was{' '}
                <span className="font-mono font-semibold">
                  {topSimilarity !== null ? (topSimilarity * 100).toFixed(1) : 0}%
                </span>
                , which is below the required 55% relevance threshold for high-fidelity technical answers.
              </p>
              <div className="bg-amber-100/70 p-3 rounded-lg text-xs text-amber-900 font-mono">
                Logged to Gap Report: &ldquo;{question}&rdquo;
              </div>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {onNavigateToTab && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onNavigateToTab('gap-report')}
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                  >
                    View in Gap Report
                  </Button>
                )}
                {onNavigateToTab && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onNavigateToTab('rewrite')}
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Draft Documentation for this Question
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Answer Card with Numbered Citations */}
      {answer && !isBelowThreshold && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Card
            borderVariant="teal"
            padding="md"
            title={
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00A3A1]" />
                <span>Verified Documentation Answer</span>
              </div>
            }
            headerAction={
              <div className="flex items-center gap-2">
                <Badge variant="accent" size="sm">
                  Top match: {topSimilarity ? (topSimilarity * 100).toFixed(0) : 0}%
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyAnswer}
                  icon={copied ? <Check className="w-3.5 h-3.5 text-[#2E9E6B]" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            }
          >
            {/* Answer text with custom styled citation tags */}
            <div className="prose prose-slate max-w-none text-sm text-[#1B2733] leading-relaxed whitespace-pre-wrap font-sans">
              {answer}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                Referenced {matchedChunks.length} documentation chunk{matchedChunks.length > 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-slate-400">
                Grounded via Gemini server-side RAG
              </span>
            </div>
          </Card>

          {/* Source Chunks with Clickable Numbered Citations */}
          <div>
            <h3 className="text-sm font-semibold text-[#0B1F3A] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00A3A1]" />
              <span>Source Citations</span>
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {matchedChunks.map((chunk) => {
                const isExpanded = expandedChunkId === chunk.id;
                return (
                  <div
                    key={chunk.id}
                    className="border border-[#E2E8F0] rounded-[10px] bg-white hover:border-[#00A3A1]/40 transition-colors shadow-xs overflow-hidden"
                  >
                    <div
                      onClick={() => setExpandedChunkId(isExpanded ? null : chunk.id)}
                      className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-[#00A3A1] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {chunk.citationIndex}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-sm text-[#0B1F3A]">
                            {chunk.heading}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({chunk.file})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="accent" size="sm">
                          {(chunk.similarity * 100).toFixed(0)}% match
                        </Badge>
                        <button className="text-slate-400 hover:text-slate-600 p-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t border-[#E2E8F0] bg-white space-y-2 animate-in fade-in duration-150">
                        <div className="text-xs font-mono text-slate-500 flex items-center justify-between">
                          <span>Token count: ~{chunk.tokens}</span>
                          <span>Chunk ID: {chunk.id}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {chunk.content}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State / Initial guide */}
      {!answer && !isBelowThreshold && !isLoading && (
        <div className="py-12 border-2 border-dashed border-[#E2E8F0] rounded-[12px] bg-white/60 text-center flex flex-col items-center justify-center px-4">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-[#00A3A1] flex items-center justify-center mb-3">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#0B1F3A]">
            Ready to query your documentation
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Type any question above or click one of the quick samples. DocPilot searches the vector index, scores relevance, extracts context, and generates citations.
          </p>
        </div>
      )}
    </div>
  );
};
