/**
 * ComparisonTestPicker Component
 * Select goal tests to run in comparison mode
 */

import { Spinner } from '../../ui';
import { cn } from '../../../utils/cn';
import type { AvailableGoalTest } from '../../../types/sandbox.types';

interface ComparisonTestPickerProps {
  availableTests: AvailableGoalTest[];
  selectedTestIds: string[];
  loading?: boolean;
  onToggleTest: (testId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'happy-path': {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-l-green-500',
  },
  'edge-case': {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-l-yellow-500',
  },
  'error-handling': {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-l-red-500',
  },
};

export function ComparisonTestPicker({
  availableTests,
  selectedTestIds,
  loading = false,
  onToggleTest,
  onSelectAll,
  onDeselectAll,
}: ComparisonTestPickerProps) {
  // Group tests by category
  const testsByCategory = availableTests.reduce((acc, test) => {
    if (!acc[test.category]) {
      acc[test.category] = [];
    }
    acc[test.category].push(test);
    return acc;
  }, {} as Record<string, AvailableGoalTest[]>);

  const allSelected = selectedTestIds.length === availableTests.length && availableTests.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (availableTests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>No goal tests available.</p>
        <p className="text-sm mt-1">Create goal tests to run comparisons.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with select all/none */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Select Tests
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({selectedTestIds.length}/{availableTests.length} selected)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Tests grouped by category */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
        {Object.entries(testsByCategory).map(([category, tests]) => {
          const styles = CATEGORY_STYLES[category] || CATEGORY_STYLES['happy-path'];
          const categorySelected = tests.filter(t => selectedTestIds.includes(t.id)).length;

          return (
            <div key={category} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-0.5 text-xs font-medium rounded capitalize', styles.bg, styles.text)}>
                    {category.replace('-', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {categorySelected}/{tests.length}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                {tests.map(test => {
                  const isSelected = selectedTestIds.includes(test.id);
                  // Use composite key to avoid React duplicate key warnings when same ID exists in multiple sources
                  const uniqueKey = `${test.id}-${test.source}`;

                  return (
                    <label
                      key={uniqueKey}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border-l-4',
                        styles.border,
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleTest(test.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {test.id}
                          </span>
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white truncate block">
                          {test.name}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
