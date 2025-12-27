/**
 * TranscriptComparison Component
 * Side-by-side view of before/after transcripts
 * Part of Phase 4 of the Advanced Tuning Tab implementation
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../../ui';
import type { ConversationTurn } from '../../../types/testMonitor.types';
import { cn } from '../../../utils/cn';

interface TranscriptComparisonProps {
  /** Before transcript (from original failing run) */
  beforeTranscript: ConversationTurn[];
  /** After transcript (from verification run) */
  afterTranscript: ConversationTurn[];
  /** Test name for display */
  testName?: string;
  /** Run IDs for reference */
  beforeRunId?: string;
  afterRunId?: string;
  /** Callback when close is clicked */
  onClose?: () => void;
}

interface DiffResult {
  index: number;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  before?: ConversationTurn;
  after?: ConversationTurn;
}

/**
 * Simple diff algorithm for transcript comparison
 */
function computeDiff(before: ConversationTurn[], after: ConversationTurn[]): DiffResult[] {
  const results: DiffResult[] = [];
  const maxLen = Math.max(before.length, after.length);

  for (let i = 0; i < maxLen; i++) {
    const beforeTurn = before[i];
    const afterTurn = after[i];

    if (!beforeTurn && afterTurn) {
      results.push({ index: i, type: 'added', after: afterTurn });
    } else if (beforeTurn && !afterTurn) {
      results.push({ index: i, type: 'removed', before: beforeTurn });
    } else if (beforeTurn && afterTurn) {
      // Compare content
      const contentChanged = beforeTurn.content !== afterTurn.content;
      const roleChanged = beforeTurn.role !== afterTurn.role;

      if (contentChanged || roleChanged) {
        results.push({ index: i, type: 'changed', before: beforeTurn, after: afterTurn });
      } else {
        results.push({ index: i, type: 'unchanged', before: beforeTurn, after: afterTurn });
      }
    }
  }

  return results;
}

const roleColors = {
  user: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  assistant: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
};

const diffColors = {
  added: 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500',
  removed: 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500',
  changed: 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500',
  unchanged: '',
};

function TranscriptMessage({ turn, highlight }: { turn: ConversationTurn; highlight?: boolean }) {
  return (
    <div className={cn(
      'p-3 rounded-lg',
      roleColors[turn.role],
      highlight && 'ring-2 ring-yellow-400'
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase">
          {turn.role === 'user' ? 'User' : 'Bot'}
        </span>
        {turn.responseTimeMs && (
          <span className="text-xs opacity-70">
            {turn.responseTimeMs}ms
          </span>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
      {turn.validationPassed !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span className={turn.validationPassed ? 'text-green-600' : 'text-red-600'}>
            {turn.validationPassed ? '✓' : '✗'}
          </span>
          <span className="opacity-70">
            {turn.validationMessage || (turn.validationPassed ? 'Passed' : 'Failed')}
          </span>
        </div>
      )}
    </div>
  );
}

export function TranscriptComparison({
  beforeTranscript,
  afterTranscript,
  testName,
  beforeRunId,
  afterRunId,
  onClose,
}: TranscriptComparisonProps) {
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const [syncScroll, setSyncScroll] = useState(true);
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  // Compute diff
  const diff = computeDiff(beforeTranscript, afterTranscript);
  const diffCount = diff.filter(d => d.type !== 'unchanged').length;

  // First diff index for "jump to diff" feature
  const firstDiffIndex = diff.findIndex(d => d.type !== 'unchanged');

  // Synchronized scrolling
  useEffect(() => {
    if (!syncScroll) return;

    const handleScroll = (source: 'before' | 'after') => {
      const sourceRef = source === 'before' ? beforeRef.current : afterRef.current;
      const targetRef = source === 'before' ? afterRef.current : beforeRef.current;

      if (sourceRef && targetRef) {
        targetRef.scrollTop = sourceRef.scrollTop;
      }
    };

    const beforeEl = beforeRef.current;
    const afterEl = afterRef.current;

    const beforeHandler = () => handleScroll('before');
    const afterHandler = () => handleScroll('after');

    beforeEl?.addEventListener('scroll', beforeHandler);
    afterEl?.addEventListener('scroll', afterHandler);

    return () => {
      beforeEl?.removeEventListener('scroll', beforeHandler);
      afterEl?.removeEventListener('scroll', afterHandler);
    };
  }, [syncScroll]);

  // Jump to first diff
  const jumpToFirstDiff = () => {
    if (firstDiffIndex >= 0 && beforeRef.current) {
      const diffElement = beforeRef.current.querySelector(`[data-diff-index="${firstDiffIndex}"]`);
      if (diffElement) {
        diffElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Filter diff if showing only changes
  const displayDiff = showDiffOnly ? diff.filter(d => d.type !== 'unchanged') : diff;

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              Transcript Comparison
              {diffCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full">
                  {diffCount} difference{diffCount !== 1 ? 's' : ''}
                </span>
              )}
            </h3>
            {testName && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {testName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle sync scroll */}
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
                className="rounded border-gray-300"
              />
              Sync scroll
            </label>
            {/* Toggle show diff only */}
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showDiffOnly}
                onChange={(e) => setShowDiffOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              Diff only
            </label>
            {/* Jump to first diff */}
            {firstDiffIndex >= 0 && (
              <button
                onClick={jumpToFirstDiff}
                className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
              >
                Jump to diff
              </button>
            )}
            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comparison panels */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 min-h-0">
        {/* Before panel */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Before (Original)
            </span>
            {beforeRunId && (
              <span className="text-xs text-gray-400">
                Run: {beforeRunId.slice(0, 8)}...
              </span>
            )}
          </div>
          <div
            ref={beforeRef}
            className="flex-1 overflow-y-auto space-y-3 pr-2"
          >
            {displayDiff.map((item, idx) => (
              <div
                key={idx}
                data-diff-index={item.index}
                className={cn('rounded-lg', diffColors[item.type])}
              >
                {item.before ? (
                  <TranscriptMessage turn={item.before} highlight={item.type !== 'unchanged'} />
                ) : (
                  <div className="p-3 text-center text-sm text-gray-400 dark:text-gray-500 italic">
                    (No matching message)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* After panel */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              After (Verification)
            </span>
            {afterRunId && (
              <span className="text-xs text-gray-400">
                Run: {afterRunId.slice(0, 8)}...
              </span>
            )}
          </div>
          <div
            ref={afterRef}
            className="flex-1 overflow-y-auto space-y-3 pr-2"
          >
            {displayDiff.map((item, idx) => (
              <div
                key={idx}
                data-diff-index={item.index}
                className={cn('rounded-lg', diffColors[item.type])}
              >
                {item.after ? (
                  <TranscriptMessage turn={item.after} highlight={item.type !== 'unchanged'} />
                ) : (
                  <div className="p-3 text-center text-sm text-gray-400 dark:text-gray-500 italic">
                    (No matching message)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span>Added</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span>Removed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded" />
          <span>Changed</span>
        </div>
      </div>
    </Card>
  );
}

export default TranscriptComparison;
