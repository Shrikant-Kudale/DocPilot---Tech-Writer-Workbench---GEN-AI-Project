/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Plus,
  ArrowRight,
  Filter,
  Check,
  FileText,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Table, Column } from '../components/Table';
import { useToast } from '../components/Toast';
import { useDocStore, GapReportItem } from '../lib/store';

interface GapReportProps {
  onDraftForGap?: (question: string) => void;
}

export const GapReport: React.FC<GapReportProps> = ({ onDraftForGap }) => {
  const store = useDocStore();
  const toast = useToast();

  const gaps = store.getGaps();

  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingGap, setIsAddingGap] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');

  const handleMarkResolved = (id: string) => {
    store.markGapResolved(id);
    toast.success('Marked documentation gap as resolved.');
  };

  const handleDeleteGap = (id: string) => {
    store.deleteGap(id);
    toast.info('Deleted gap report item.');
  };

  const handleAddManualGap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    store.logGap(newQuestion.trim(), 0.0);
    setNewQuestion('');
    setIsAddingGap(false);
    toast.success('Added new documentation gap item.');
  };

  const filteredGaps = gaps
    .filter((g) => {
      if (statusFilter === 'unresolved') return g.status === 'unresolved';
      if (statusFilter === 'resolved') return g.status === 'resolved';
      return true;
    })
    .filter((g) => g.question.toLowerCase().includes(searchQuery.toLowerCase()));

  const unresolvedCount = gaps.filter((g) => g.status === 'unresolved').length;
  const resolvedCount = gaps.filter((g) => g.status === 'resolved').length;

  const columns: Column<GapReportItem>[] = [
    {
      header: 'Unanswered Question / Doc Gap',
      accessorKey: 'question',
      width: '42%',
      cell: (row) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 block leading-snug">
            {row.question}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            ID: {row.id}
          </span>
        </div>
      ),
    },
    {
      header: 'Hits',
      accessorKey: 'count',
      width: '10%',
      cell: (row) => (
        <span className="inline-flex items-center justify-center font-mono text-xs font-bold text-slate-700 bg-slate-100 w-7 h-6 rounded">
          {row.count}
        </span>
      ),
    },
    {
      header: 'Top Sim',
      accessorKey: 'topSimilarity',
      width: '12%',
      cell: (row) => (
        <span className="text-xs font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          {(row.topSimilarity * 100).toFixed(0)}%
        </span>
      ),
    },
    {
      header: 'Date Logged',
      accessorKey: 'date',
      width: '14%',
      cell: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(row.date).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      width: '10%',
      cell: (row) => (
        <Badge
          variant={row.status === 'unresolved' ? 'warning' : 'success'}
          size="sm"
        >
          {row.status === 'unresolved' ? 'Unresolved' : 'Resolved'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      width: '12%',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          {row.status === 'unresolved' ? (
            <button
              onClick={() => handleMarkResolved(row.id)}
              className="px-2 py-1 bg-white hover:bg-[#2E9E6B]/10 text-[#2E9E6B] border border-[#2E9E6B]/40 rounded text-xs font-medium transition-colors cursor-pointer"
              title="Mark resolved"
            >
              Mark resolved
            </button>
          ) : (
            <span className="text-xs text-[#2E9E6B] flex items-center gap-1 font-medium px-2 py-1">
              <Check className="w-3.5 h-3.5" /> Done
            </span>
          )}

          {onDraftForGap && (
            <button
              onClick={() => onDraftForGap(row.question)}
              className="p-1 text-slate-400 hover:text-[#00A3A1] rounded transition-colors cursor-pointer"
              title="Draft documentation in Rewrite Assistant"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => handleDeleteGap(row.id)}
            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
            title="Delete gap"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
            Documentation Gap Report
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Tracks unanswered user questions. Use this report to discover missing topics and prioritize what documentation to write next.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setIsAddingGap(true)}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Custom Gap
        </Button>
      </div>

      {/* Friendly How this works explainer */}
      <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-700 space-y-1">
        <div className="font-semibold text-teal-900 flex items-center gap-1.5">
          <span>How to use this tool:</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          <strong>1. Where do gaps come from?</strong> Whenever a user asks a question in &ldquo;Ask the Docs&rdquo; that is not found in your uploaded files, DocPilot automatically records it here.
          <br />
          <strong>2. Prioritize by demand:</strong> The &ldquo;Hits&rdquo; counter shows how often users inquired about that topic.
          <br />
          <strong>3. Draft an answer:</strong> Click the <span className="font-bold text-teal-700">&rarr;</span> arrow button on any row to immediately open the Rewrite Assistant and author documentation for it, then click &ldquo;Mark resolved&rdquo;.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Pending Gaps
            </div>
            <div className="text-3xl font-bold text-[#F2A900] mt-1">
              {unresolvedCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Require documentation coverage
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-[#b07b00] flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Resolved Gaps
            </div>
            <div className="text-3xl font-bold text-[#2E9E6B] mt-1">
              {resolvedCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Documented & published
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-[#2E9E6B] flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Logged Queries
            </div>
            <div className="text-3xl font-bold text-[#0B1F3A] mt-1">
              {gaps.reduce((acc, curr) => acc + curr.count, 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Accumulated user inquiries
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Table Card */}
      <Card
        padding="none"
        title={`Unanswered Queries Log (${filteredGaps.length})`}
        subtitle="Ranked by frequency and similarity deficit"
        headerAction={
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('unresolved')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'unresolved'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Unresolved
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'resolved'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Resolved
              </button>
            </div>

            <input
              type="text"
              placeholder="Search gaps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 px-3 text-xs rounded border border-[#E2E8F0] focus:outline-none focus:border-[#00A3A1]"
            />
          </div>
        }
      >
        <Table
          data={filteredGaps}
          columns={columns}
          keyExtractor={(row) => row.id}
          emptyState={
            <div className="py-12 text-center text-slate-500 text-sm">
              No documentation gaps recorded. Queries with similarity &lt; 0.55 in Tab 1 will appear here.
            </div>
          }
        />
      </Card>

      {/* Manual Gap Modal */}
      {isAddingGap && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-semibold text-[#0B1F3A]">
              Log Manual Documentation Gap
            </h3>
            <p className="text-xs text-slate-500">
              Record a missing topic requested by developers or flagged in customer tickets.
            </p>

            <form onSubmit={handleAddManualGap} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Missing Topic or Question
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How to configure mutual TLS (mTLS) for webhooks?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full h-9 px-3 rounded border border-[#E2E8F0] text-xs text-slate-800 focus:outline-none focus:border-[#00A3A1]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setIsAddingGap(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" variant="primary" type="submit">
                  Log Gap
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
