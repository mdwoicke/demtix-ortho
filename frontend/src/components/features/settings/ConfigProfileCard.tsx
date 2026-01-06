/**
 * ConfigProfileCard Component
 * Displays a single configuration profile with actions
 */

import { useState } from 'react';
import { Spinner } from '../../ui';
import { cn } from '../../../utils/cn';
import type { ConfigTestResult } from '../../../types/appSettings.types';

interface ConfigProfileCardProps {
  id: number;
  name: string;
  primaryValue: string;
  primaryLabel: string;
  secondaryValue?: string;
  secondaryLabel?: string;
  hasSecret: boolean;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => Promise<void>;
  onTest: () => Promise<ConfigTestResult>;
  className?: string;
}

export function ConfigProfileCard({
  name,
  primaryValue,
  primaryLabel,
  secondaryValue,
  secondaryLabel,
  hasSecret,
  isDefault,
  onEdit,
  onDelete,
  onSetDefault,
  onTest,
  className,
}: ConfigProfileCardProps) {
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConfigTestResult | null>(null);

  const handleSetDefault = async () => {
    if (isDefault || isSettingDefault) return;
    setIsSettingDefault(true);
    try {
      await onSetDefault();
    } finally {
      setIsSettingDefault(false);
    }
  };

  const handleTest = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-4 transition-all',
        isDefault
          ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isDefault && (
            <span className="text-yellow-500" title="Default configuration">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          )}
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{name}</h4>
          {isDefault && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
              Default
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Edit configuration"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Delete configuration"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">{primaryLabel}: </span>
          <span className="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
            {primaryValue.length > 60 ? `${primaryValue.substring(0, 60)}...` : primaryValue}
          </span>
        </div>
        {secondaryValue && secondaryLabel && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">{secondaryLabel}: </span>
            <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
              {secondaryValue}
            </span>
          </div>
        )}
        {hasSecret && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Secret configured</span>
          </div>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={cn(
            'mt-3 px-3 py-2 text-xs rounded flex items-center gap-2',
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          )}
        >
          {testResult.success ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          <span>
            {testResult.message}
            {testResult.responseTimeMs && ` (${testResult.responseTimeMs}ms)`}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleTest}
          disabled={isTesting}
          className={cn(
            'flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors',
            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
            'hover:bg-gray-200 dark:hover:bg-gray-600',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-1'
          )}
        >
          {isTesting ? (
            <>
              <Spinner size="sm" />
              Testing...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Test
            </>
          )}
        </button>
        {!isDefault && (
          <button
            onClick={handleSetDefault}
            disabled={isSettingDefault}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors',
              'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
              'hover:bg-blue-200 dark:hover:bg-blue-800',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-1'
            )}
          >
            {isSettingDefault ? (
              <>
                <Spinner size="sm" />
                Setting...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Set Default
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
