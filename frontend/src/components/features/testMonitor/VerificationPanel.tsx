/**
 * VerificationPanel Component
 * Displays recently applied fixes and allows re-running affected tests to verify effectiveness
 */

import { useState, useCallback, useMemo } from 'react';
import { Card, Button } from '../../ui';
import type { GeneratedFix, VerificationResult, VerificationSummary } from '../../../types/testMonitor.types';

interface VerificationPanelProps {
  appliedFixes: GeneratedFix[];
  onVerify: (fixIds: string[]) => Promise<VerificationSummary | null>;
  verifying: boolean;
  lastVerification?: VerificationSummary | null;
  onFixVerified?: (fixId: string) => void;
}

export function VerificationPanel({
  appliedFixes,
  onVerify,
  verifying,
  lastVerification,
  onFixVerified,
}: VerificationPanelProps) {
  const [selectedFixIds, setSelectedFixIds] = useState<Set<string>>(new Set());
  const [_expandedResults, _setExpandedResults] = useState(false);

  // Get fixes that have been applied and need verification
  const fixesNeedingVerification = useMemo(() => {
    return appliedFixes.filter(fix =>
      fix.status === 'applied' &&
      fix.affectedTests.length > 0
    );
  }, [appliedFixes]);

  // Get unique affected tests from selected fixes
  const affectedTests = useMemo(() => {
    const tests = new Set<string>();
    fixesNeedingVerification
      .filter(fix => selectedFixIds.has(fix.fixId))
      .forEach(fix => {
        fix.affectedTests.forEach(t => tests.add(t));
      });
    return Array.from(tests);
  }, [fixesNeedingVerification, selectedFixIds]);

  const handleToggleFix = useCallback((fixId: string) => {
    setSelectedFixIds(prev => {
      const next = new Set(prev);
      if (next.has(fixId)) {
        next.delete(fixId);
      } else {
        next.add(fixId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedFixIds.size === fixesNeedingVerification.length) {
      setSelectedFixIds(new Set());
    } else {
      setSelectedFixIds(new Set(fixesNeedingVerification.map(f => f.fixId)));
    }
  }, [fixesNeedingVerification, selectedFixIds.size]);

  const handleVerify = useCallback(async () => {
    if (selectedFixIds.size === 0) return;

    try {
      const result = await onVerify(Array.from(selectedFixIds));

      // Auto-update fix status to 'verified' for effective fixes
      if (result?.results && onFixVerified) {
        const effectiveFixes = result.results
          .filter((r: VerificationResult) => r.effective)
          .map((r: VerificationResult) => r.fixId);

        for (const fixId of effectiveFixes) {
          onFixVerified(fixId);
        }
      }
    } catch (error) {
      console.error('Verification failed:', error);
    }
  }, [onVerify, selectedFixIds, onFixVerified]);

  const isDisabled = selectedFixIds.size === 0 || verifying;

  // Calculate effectiveness from last result
  const effectiveness = useMemo(() => {
    if (!lastVerification) return null;
    const { improved, totalTests } = lastVerification;
    return totalTests > 0 ? Math.round((improved / totalTests) * 100) : 0;
  }, [lastVerification]);

  if (fixesNeedingVerification.length === 0 && !lastVerification) {
    return null;
  }

  return (
    <Card className="mt-4">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verification
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Re-run affected tests to verify fix effectiveness
            </p>
          </div>

          {effectiveness !== null && (
            <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              effectiveness >= 80
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : effectiveness >= 50
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {effectiveness}% Effective
            </div>
          )}
        </div>

        {fixesNeedingVerification.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Applied Fixes ({fixesNeedingVerification.length})
              </span>
              <button
                onClick={handleSelectAll}
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                {selectedFixIds.size === fixesNeedingVerification.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            {/* Fix checkboxes */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {fixesNeedingVerification.map(fix => (
                <label
                  key={fix.fixId}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFixIds.has(fix.fixId)}
                    onChange={() => handleToggleFix(fix.fixId)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {fix.changeDescription.slice(0, 60)}...
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {fix.affectedTests.length} affected test{fix.affectedTests.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Selected:</span>
              <span className="font-medium text-gray-900 dark:text-white">{selectedFixIds.size}</span>
            </div>
            {affectedTests.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Tests:</span>
                <span className="font-medium text-gray-900 dark:text-white">{affectedTests.length}</span>
              </div>
            )}
            {verifying && (
              <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span className="text-sm">Running tests...</span>
              </div>
            )}
          </div>
          <Button onClick={handleVerify} disabled={isDisabled} variant="primary" size="sm" className="flex items-center gap-2">
            {verifying ? 'Verifying...' : 'Verify Selected'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default VerificationPanel;
