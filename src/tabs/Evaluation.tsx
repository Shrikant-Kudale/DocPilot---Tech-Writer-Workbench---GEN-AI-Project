/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  BarChart3,
  Plus,
  Trash2,
  FileCheck,
  Percent,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Table, Column } from '../components/Table';
import { useToast } from '../components/Toast';
import { useDocStore, GoldenQuestion, EvalResultItem, EvalRun } from '../lib/store';
import { rankChunks, textToVectorFallback } from '../lib/similarity';

export const Evaluation: React.FC = () => {
  const store = useDocStore();
  const toast = useToast();

  const goldenQuestions = store.getGoldenQuestions();
  const evalRuns = store.getEvalRuns();

  const [isRunning, setIsRunning] = useState(false);
  const [latestRun, setLatestRun] = useState<EvalRun | null>(evalRuns[0] || null);

  // New question modal state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newExpectedFile, setNewExpectedFile] = useState('authentication.md');
  const [newExpectedHeading, setNewExpectedHeading] = useState('Bearer Token Authentication');
  const [newKeywords, setNewKeywords] = useState('Bearer, Authorization header, 401');

  const handleRunEvaluation = async () => {
    if (goldenQuestions.length === 0) {
      toast.warning('Golden question set is empty. Add benchmark questions first.');
      return;
    }

    const allChunks = store.getChunks();
    if (allChunks.length === 0) {
      toast.error('Knowledge Base is empty. Cannot evaluate retrieval.');
      return;
    }

    setIsRunning(true);
    toast.info(`Running retrieval and accuracy evaluation across ${goldenQuestions.length} benchmark questions...`);

    try {
      const results: EvalResultItem[] = [];
      let totalHits = 0;
      let totalAccuracy = 0;

      for (const q of goldenQuestions) {
        // Step 1: Embed question
        let queryVec: number[] = [];
        try {
          const res = await fetch('/api/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: q.question }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.embeddings && data.embeddings[0]) {
              queryVec = data.embeddings[0];
            }
          }
        } catch {
          // fallback
        }

        if (queryVec.length === 0) {
          queryVec = textToVectorFallback(q.question);
        }

        // Step 2: Rank chunks with hybrid search
        const { ranked, topSimilarity } = rankChunks(queryVec, allChunks, q.question);
        const top3 = ranked.slice(0, 3);
        const top1 = top3[0];

        // Check if expected chunk or file was retrieved in top 3 (Hit@3)
        const hit = top3.some(
          (c) =>
            c.id === q.expectedChunkId ||
            c.file.toLowerCase() === q.expectedFile.toLowerCase() ||
            (q.expectedHeading && c.heading.toLowerCase().includes(q.expectedHeading.toLowerCase()))
        );

        if (hit) totalHits += 1;

        // Calculate keyword recall accuracy
        let keywordHits = 0;
        const retrievedContent = top3.map((c) => c.content.toLowerCase()).join(' ');
        q.expectedKeywords.forEach((kw) => {
          if (retrievedContent.includes(kw.toLowerCase())) {
            keywordHits += 1;
          }
        });

        const keywordRatio =
          q.expectedKeywords.length > 0 ? keywordHits / q.expectedKeywords.length : 1;
        const accuracyScore = Math.round((hit ? 60 : 20) + keywordRatio * 40);
        totalAccuracy += accuracyScore;

        results.push({
          questionId: q.id,
          question: q.question,
          expectedFile: q.expectedFile,
          retrievedChunkId: top1?.id,
          retrievedFile: top1?.file,
          retrievalHit: hit,
          similarity: topSimilarity,
          accuracyScore,
          notes: hit ? 'Expected source matched in Top 3' : 'Expected source not in Top 3',
        });
      }

      const hitRate = Math.round((totalHits / goldenQuestions.length) * 100);
      const avgAccuracy = Math.round(totalAccuracy / goldenQuestions.length);

      const runRecord: EvalRun = {
        id: `eval-${Date.now()}`,
        timestamp: new Date().toISOString(),
        hitRate,
        avgAccuracy,
        totalEvaluated: goldenQuestions.length,
        results,
      };

      store.saveEvalRun(runRecord);
      setLatestRun(runRecord);
      toast.success(
        `Evaluation complete: Hit Rate ${hitRate}%, Accuracy ${avgAccuracy}%`
      );
    } catch (err: any) {
      console.error('Evaluation run failed:', err);
      toast.error(err.message || 'Evaluation run failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    const newQ: GoldenQuestion = {
      id: `gold-${Date.now()}`,
      question: newQuestionText.trim(),
      expectedChunkId: `chunk-${newExpectedFile.replace('.md', '')}-1`,
      expectedFile: newExpectedFile.trim(),
      expectedHeading: newExpectedHeading.trim(),
      expectedKeywords: newKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      category: 'General',
    };

    store.setGoldenQuestions([...goldenQuestions, newQ]);
    setIsAddingQuestion(false);
    setNewQuestionText('');
    toast.success('Added new golden benchmark test question.');
  };

  const handleDeleteQuestion = (id: string) => {
    store.setGoldenQuestions(goldenQuestions.filter((q) => q.id !== id));
    toast.info('Deleted golden question');
  };

  const columns: Column<GoldenQuestion>[] = [
    {
      header: 'Golden Question',
      accessorKey: 'question',
      width: '40%',
      cell: (row) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 block">
            {row.question}
          </span>
          <span className="text-[11px] text-slate-400">
            Category: {row.category}
          </span>
        </div>
      ),
    },
    {
      header: 'Expected Source',
      width: '28%',
      cell: (row) => (
        <div>
          <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
            {row.expectedFile}
          </span>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {row.expectedHeading}
          </div>
        </div>
      ),
    },
    {
      header: 'Keywords',
      width: '24%',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.expectedKeywords.map((kw, i) => (
            <span
              key={i}
              className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
            >
              {kw}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Action',
      width: '8%',
      cell: (row) => (
        <button
          onClick={() => handleDeleteQuestion(row.id)}
          className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
            Evaluation
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Test your documentation accuracy with a golden question benchmark. Measures whether search returns the right source files.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddingQuestion(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Golden Question
          </Button>
          <Button
            size="md"
            variant="primary"
            isLoading={isRunning}
            onClick={handleRunEvaluation}
            icon={<Play className="w-4 h-4" />}
          >
            Run Evaluation
          </Button>
        </div>
      </div>

      {/* Friendly How this works explainer */}
      <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-700 space-y-1">
        <div className="font-semibold text-teal-900 flex items-center gap-1.5">
          <span>How to use this tool:</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          <strong>1. Golden Questions:</strong> The table below lists standard benchmark questions and the exact file that is supposed to answer them.
          <br />
          <strong>2. Click &ldquo;Run Evaluation&rdquo;:</strong> DocPilot runs every question against your current Knowledge Base to test whether the correct file was found.
          <br />
          <strong>3. Hit Rate & Accuracy:</strong> Look at the stat cards and bar chart to see your score. If you add new documentation files, re-run this to verify search quality improves!
        </p>
      </div>

      {/* Stat Cards */}
      {latestRun && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-150">
          <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Retrieval Hit Rate
              </div>
              <div
                className={`text-3xl font-bold mt-1 ${
                  latestRun.hitRate >= 80 ? 'text-[#2E9E6B]' : 'text-[#F2A900]'
                }`}
              >
                {latestRun.hitRate}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Target: &gt; 80% (Hit@3)
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2E9E6B] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Answer Accuracy
              </div>
              <div className="text-3xl font-bold text-[#0B1F3A] mt-1">
                {latestRun.avgAccuracy}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Keyword recall & relevance
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#00A3A1] flex items-center justify-center">
              <Percent className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Golden Benchmark Run
              </div>
              <div className="text-xl font-bold text-[#0B1F3A] mt-1">
                {latestRun.totalEvaluated} Questions
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {new Date(latestRun.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileCheck className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Bar Chart Section */}
      {latestRun && latestRun.results.length > 0 && (
        <Card
          padding="md"
          title={
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#00A3A1]" />
              <span>Retrieval & Accuracy Performance Chart</span>
            </div>
          }
          subtitle="Score distribution per benchmark question (0-100%)"
        >
          <div className="space-y-4 pt-2">
            {latestRun.results.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-lg">
                    {item.retrievalHit ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2E9E6B] shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-[#D64545] shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800 truncate">
                      {item.question}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-400">
                      Sim: {(item.similarity * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`font-bold ${
                        item.accuracyScore >= 80 ? 'text-[#2E9E6B]' : 'text-[#b07b00]'
                      }`}
                    >
                      {item.accuracyScore}%
                    </span>
                  </div>
                </div>

                {/* Bar */}
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.retrievalHit ? 'bg-[#00A3A1]' : 'bg-[#D64545]'
                    }`}
                    style={{ width: `${Math.max(8, item.accuracyScore)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00A3A1]" /> Hit @ 3 Match
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D64545]" /> Missed Target
              </span>
            </div>
            <span>Ground truth: expected source matched</span>
          </div>
        </Card>
      )}

      {/* Editable Golden Dataset Table */}
      <Card
        padding="none"
        title={`Golden Benchmark Questions (${goldenQuestions.length})`}
        subtitle="Curated ground-truth QA pairs used for deterministic regression testing"
        headerAction={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              store.setGoldenQuestions([
                {
                  id: 'gold-1',
                  question: 'How do I authenticate API requests?',
                  expectedChunkId: 'chunk-auth-1',
                  expectedFile: 'authentication.md',
                  expectedHeading: 'Bearer Token Authentication',
                  expectedKeywords: ['Authorization header', 'Bearer', '401'],
                  category: 'Security',
                },
                {
                  id: 'gold-2',
                  question: 'What is the webhook retry policy if our server returns a 500 error?',
                  expectedChunkId: 'chunk-webhook-2',
                  expectedFile: 'webhooks.md',
                  expectedHeading: 'Retry Schedule & Backoff',
                  expectedKeywords: ['exponential backoff', '5 attempts', '24 hours'],
                  category: 'Integrations',
                },
                {
                  id: 'gold-3',
                  question: 'What are the default rate limits for Tier 1 accounts?',
                  expectedChunkId: 'chunk-ratelimit-1',
                  expectedFile: 'rate-limits.md',
                  expectedHeading: 'Account Tier Limits',
                  expectedKeywords: ['100 requests per minute', '429'],
                  category: 'API Limits',
                },
              ]);
              toast.info('Reset golden questions to standard benchmark.');
            }}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset Golden Set
          </Button>
        }
      >
        <Table
          data={goldenQuestions}
          columns={columns}
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Add Golden Question Modal */}
      {isAddingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-semibold text-[#0B1F3A]">
              Add Golden Benchmark Question
            </h3>

            <form onSubmit={handleAddQuestion} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Question
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How do I configure OAuth in the portal?"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="w-full h-8 px-3 rounded border border-[#E2E8F0] text-xs text-slate-800 focus:outline-none focus:border-[#00A3A1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Expected File
                  </label>
                  <input
                    type="text"
                    required
                    value={newExpectedFile}
                    onChange={(e) => setNewExpectedFile(e.target.value)}
                    className="w-full h-8 px-3 rounded border border-[#E2E8F0] text-xs text-slate-800 focus:outline-none focus:border-[#00A3A1]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Expected Heading
                  </label>
                  <input
                    type="text"
                    required
                    value={newExpectedHeading}
                    onChange={(e) => setNewExpectedHeading(e.target.value)}
                    className="w-full h-8 px-3 rounded border border-[#E2E8F0] text-xs text-slate-800 focus:outline-none focus:border-[#00A3A1]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Expected Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Bearer, Authorization, token"
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  className="w-full h-8 px-3 rounded border border-[#E2E8F0] text-xs text-slate-800 focus:outline-none focus:border-[#00A3A1]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setIsAddingQuestion(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" variant="primary" type="submit">
                  Save Golden Question
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
