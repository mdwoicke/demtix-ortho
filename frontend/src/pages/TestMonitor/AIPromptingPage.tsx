/**
 * AI Prompting Page
 * AI-powered prompt enhancement with templates, web search, and quality scoring
 */

import React, { useState, useEffect } from 'react';
import type {
  EnhanceResult,
  EnhancementTemplate,
  EnhancementHistory,
  QualityScore,
} from '../../types/aiPrompting.types';
import {
  FILE_KEY_DISPLAY_NAMES,
} from '../../types/aiPrompting.types';
import type { PromptFile, PromptVersionHistory } from '../../types/testMonitor.types';
import * as testMonitorApi from '../../services/api/testMonitorApi';

// File icons for each prompt type
const FILE_ICONS: Record<string, React.ReactNode> = {
  system_prompt: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  patient_tool: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  scheduling_tool: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Format time ago utility
 */
const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * Prompt File List Component - Shows all prompt files with versions
 */
const PromptFileList: React.FC<{
  files: PromptFile[];
  selectedFileKey: string;
  loading?: boolean;
  onSelectFile: (fileKey: string) => void;
}> = ({ files, selectedFileKey, loading = false, onSelectFile }) => {
  if (loading && files.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Prompt Files
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {files.length} files
        </span>
      </div>

      {files.map(file => {
        const isSelected = selectedFileKey === file.fileKey;

        return (
          <div
            key={file.fileKey}
            onClick={() => onSelectFile(file.fileKey)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
              isSelected
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded ${
                isSelected
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50'
                  : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
              }`}>
                {FILE_ICONS[file.fileKey] || FILE_ICONS.system_prompt}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    isSelected
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {FILE_KEY_DISPLAY_NAMES[file.fileKey] || file.displayName}
                  </span>

                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                    isSelected
                      ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    v{file.version}
                  </span>
                </div>

                {file.updatedAt && (
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <span>Updated {formatTimeAgo(file.updatedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            <svg
              className={`w-4 h-4 transition-transform ${
                isSelected ? 'rotate-90 text-blue-500' : 'text-gray-400'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

/**
 * AI Enhancements List Component - Shows pending and applied AI-generated enhancements
 */
const AIEnhancementsList: React.FC<{
  enhancements: EnhancementHistory[];
  selectedEnhancementId: string | null;
  currentPreview: EnhanceResult | null;
  loading?: boolean;
  onSelectEnhancement: (enhancementId: string) => void;
  onApplyEnhancement: (enhancementId: string) => void;
  onPromoteEnhancement: (enhancementId: string) => void;
  onDiscardEnhancement: (enhancementId: string) => void;
}> = ({
  enhancements,
  selectedEnhancementId,
  currentPreview,
  loading = false,
  onSelectEnhancement,
  onApplyEnhancement,
  onPromoteEnhancement,
  onDiscardEnhancement,
}) => {
  // Count enhancements by status
  const pendingCount = enhancements.filter(e => e.status === 'pending' || e.status === 'completed').length;
  const appliedCount = enhancements.filter(e => e.status === 'applied').length;
  const hasCurrentPreview = currentPreview !== null;

  // Get enhancements that are ready to apply (completed) or promote (applied)
  const completedEnhancements = enhancements.filter(e => e.status === 'completed' || e.status === 'pending');
  const appliedEnhancements = enhancements.filter(e => e.status === 'applied');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          AI Enhancements
        </h3>
        <div className="flex gap-2 text-xs">
          {(pendingCount > 0 || hasCurrentPreview) && (
            <span className="text-yellow-600 dark:text-yellow-400">
              {pendingCount + (hasCurrentPreview ? 1 : 0)} pending
            </span>
          )}
          {appliedCount > 0 && (
            <span className="text-green-600 dark:text-green-400">
              {appliedCount} ready
            </span>
          )}
        </div>
      </div>

      {loading && enhancements.length === 0 && !currentPreview && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
        </div>
      )}

      {!loading && enhancements.length === 0 && !currentPreview && (
        <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          No AI enhancements yet.
          <br />
          <span className="text-xs">Generate one using the command panel →</span>
        </div>
      )}

      {/* Current Preview (unsaved) */}
      {currentPreview && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border-2 border-dashed border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Current Preview
                </span>
                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
                  Unsaved
                </span>
              </div>
              <div className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">
                {FILE_KEY_DISPLAY_NAMES[currentPreview.fileKey] || currentPreview.fileKey}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Applied Enhancements - Ready to Promote */}
      {appliedEnhancements.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide px-1">
            Ready to Promote
          </div>
          {appliedEnhancements.map(enhancement => {
            const isSelected = selectedEnhancementId === enhancement.enhancementId;

            return (
              <div
                key={enhancement.enhancementId}
                onClick={() => onSelectEnhancement(enhancement.enhancementId)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`p-1.5 rounded flex-shrink-0 ${
                    isSelected
                      ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50'
                      : 'text-green-500 dark:text-green-500 bg-green-100 dark:bg-green-900/30'
                  }`}>
                    {FILE_ICONS[enhancement.fileKey] || FILE_ICONS.system_prompt}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-sm font-medium truncate ${
                        isSelected
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-green-800 dark:text-green-300'
                      }`}>
                        {FILE_KEY_DISPLAY_NAMES[enhancement.fileKey] || enhancement.fileKey}
                      </span>
                      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 flex-shrink-0">
                        Applied
                      </span>
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-500 mt-0.5 truncate">
                      {enhancement.command.substring(0, 20)}...
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPromoteEnhancement(enhancement.enhancementId);
                    }}
                    className="px-1.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                    title="Promote to Production"
                  >
                    Promote
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDiscardEnhancement(enhancement.enhancementId);
                    }}
                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-colors"
                    title="Discard"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Enhancements - Ready to Apply */}
      {completedEnhancements.length > 0 && (
        <div className="space-y-2">
          {appliedEnhancements.length > 0 && (
            <div className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide px-1 mt-3">
              Pending Review
            </div>
          )}
          {completedEnhancements.map(enhancement => {
            const isSelected = selectedEnhancementId === enhancement.enhancementId;

            return (
              <div
                key={enhancement.enhancementId}
                onClick={() => onSelectEnhancement(enhancement.enhancementId)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`p-1.5 rounded flex-shrink-0 ${
                    isSelected
                      ? 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50'
                      : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {FILE_ICONS[enhancement.fileKey] || FILE_ICONS.system_prompt}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-sm font-medium truncate ${
                        isSelected
                          ? 'text-purple-700 dark:text-purple-300'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {FILE_KEY_DISPLAY_NAMES[enhancement.fileKey] || enhancement.fileKey}
                      </span>
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                        isSelected
                          ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200'
                          : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400'
                      }`}>
                        Pending
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {enhancement.command.substring(0, 20)}...
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onApplyEnhancement(enhancement.enhancementId);
                    }}
                    className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 rounded transition-colors"
                    title="Apply"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDiscardEnhancement(enhancement.enhancementId);
                    }}
                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-colors"
                    title="Discard"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Apply Description Modal - Gets user description when applying enhancement
 */
const ApplyDescriptionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (description: string) => void;
  isLoading: boolean;
  defaultDescription: string;
}> = ({ isOpen, onClose, onConfirm, isLoading, defaultDescription }) => {
  const [description, setDescription] = useState(defaultDescription);

  useEffect(() => {
    setDescription(defaultDescription);
  }, [defaultDescription]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 mx-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Apply Enhancement
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Add a description for this version change (optional). A default description will be used if left empty.
        </p>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Version Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Enter a description for this change..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Default: {defaultDescription}
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(description)}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Applying...' : 'Apply Enhancement'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Quality Score Card Component
 */
const QualityScoreCard: React.FC<{
  score: QualityScore;
  label: string;
  comparison?: { before: number; after: number };
}> = ({ score, label, comparison }) => {
  const getColorClass = (value: number) => {
    if (value >= 80) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
    if (value >= 60) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">{label}</h4>
      <div className="flex items-center gap-4 mb-4">
        <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getColorClass(score.overall)}`}>
          {Math.round(score.overall)}
        </div>
        {comparison && (
          <div className="text-sm">
            <span className={comparison.after > comparison.before ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {comparison.after > comparison.before ? '+' : ''}{Math.round(comparison.after - comparison.before)} pts
            </span>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {Object.entries(score.dimensions).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-24 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-300 w-8">{value}</span>
          </div>
        ))}
      </div>
      {/* Content Metrics - Token, Char, Line Count */}
      {(score.tokenCount !== undefined || score.charCount !== undefined || score.lineCount !== undefined) && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Content Metrics</h5>
          <div className="grid grid-cols-3 gap-2 text-center">
            {score.tokenCount !== undefined && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2">
                <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {score.tokenCount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Tokens</div>
              </div>
            )}
            {score.charCount !== undefined && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2">
                <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                  {score.charCount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Characters</div>
              </div>
            )}
            {score.lineCount !== undefined && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2">
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {score.lineCount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Lines</div>
              </div>
            )}
          </div>
        </div>
      )}
      {score.suggestions.length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Suggestions</h5>
          <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            {score.suggestions.slice(0, 3).map((s, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-blue-500">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Template Button Component
 */
const TemplateButton: React.FC<{
  template: EnhancementTemplate;
  onClick: () => void;
  isSelected: boolean;
}> = ({ template, onClick, isSelected }) => {
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      examples: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      clarity: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
      'edge-cases': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
      format: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      validation: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
      custom: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    };
    return colors[category] || colors.custom;
  };

  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border-2 text-left transition-all bg-white dark:bg-gray-800 ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(template.category)}`}>
          {template.category}
        </span>
        {template.useWebSearch && (
          <span className="text-xs text-gray-400" title="Uses web search">
            🔍
          </span>
        )}
      </div>
      <h4 className="font-medium text-gray-800 dark:text-white">{template.name}</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{template.description}</p>
    </button>
  );
};

/**
 * Diff View Component
 */
const DiffView: React.FC<{ diff: EnhanceResult['diff'] }> = ({ diff }) => {
  if (diff.hunks.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm italic p-4">
        No changes detected
      </div>
    );
  }

  return (
    <div className="font-mono text-sm bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex gap-4 p-2 bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
        <span className="text-green-600 dark:text-green-400">+{diff.additions} additions</span>
        <span className="text-red-600 dark:text-red-400">-{diff.deletions} deletions</span>
      </div>
      <div className="max-h-96 overflow-auto">
        {diff.hunks.map((hunk, i) => (
          <div key={i} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
            {hunk.lines.map((line, j) => (
              <div
                key={j}
                className={`px-4 py-0.5 ${
                  line.type === 'add'
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : line.type === 'remove'
                    ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <span className="select-none mr-2">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                <span className="whitespace-pre-wrap break-all">{line.content}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

const AIPromptingPage: React.FC = () => {
  // State
  const [promptFiles, setPromptFiles] = useState<PromptFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFileKey, setSelectedFileKey] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
  const [versionHistory, setVersionHistory] = useState<PromptVersionHistory[]>([]);
  const [templates, setTemplates] = useState<EnhancementTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [command, setCommand] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<EnhanceResult | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [qualityScoreLoading, setQualityScoreLoading] = useState(false);
  const [enhancementHistory, setEnhancementHistory] = useState<EnhancementHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Apply modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [pendingEnhancementId, setPendingEnhancementId] = useState<string | null>(null);
  // AI Enhancements list state
  const [selectedEnhancementId, setSelectedEnhancementId] = useState<string | null>(null);
  const [selectedEnhancementDetails, setSelectedEnhancementDetails] = useState<EnhancementHistory | null>(null);
  const [enhancementDetailsLoading, setEnhancementDetailsLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadPromptFiles();
    loadTemplates();
  }, []);

  // Load version history when file changes
  useEffect(() => {
    if (selectedFileKey) {
      loadVersionHistory();
      loadEnhancementHistory();
      // Clear any stale enhancement selection when switching files
      setSelectedEnhancementId(null);
      setSelectedEnhancementDetails(null);
      setPreviewResult(null);
    }
  }, [selectedFileKey]);

  // Load quality score when file or version changes
  useEffect(() => {
    if (selectedFileKey) {
      loadQualityScore();
    }
  }, [selectedFileKey, selectedVersion]);

  const loadPromptFiles = async () => {
    setFilesLoading(true);
    try {
      const files = await testMonitorApi.getPromptFiles();
      setPromptFiles(files);
      if (files.length > 0 && !selectedFileKey) {
        setSelectedFileKey(files[0].fileKey);
      }
    } catch (err) {
      console.error('Failed to load prompt files:', err);
    } finally {
      setFilesLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const t = await testMonitorApi.getEnhancementTemplates();
      setTemplates(t);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadVersionHistory = async () => {
    try {
      const history = await testMonitorApi.getPromptHistory(selectedFileKey, 20);
      setVersionHistory(history);
    } catch (err) {
      console.error('Failed to load version history:', err);
    }
  };

  const loadEnhancementHistory = async () => {
    try {
      const history = await testMonitorApi.getEnhancementHistory(selectedFileKey, 10);
      setEnhancementHistory(history);
    } catch (err) {
      console.error('Failed to load enhancement history:', err);
    }
  };

  const loadQualityScore = async () => {
    setQualityScoreLoading(true);
    setQualityScore(null); // Clear old score immediately
    try {
      const score = await testMonitorApi.getQualityScore(selectedFileKey, selectedVersion);
      setQualityScore(score);
    } catch (err) {
      console.error('Failed to load quality score:', err);
    } finally {
      setQualityScoreLoading(false);
    }
  };

  const handleTemplateSelect = (template: EnhancementTemplate) => {
    setSelectedTemplateId(template.templateId);
    setCommand(template.commandTemplate);
    setUseWebSearch(template.useWebSearch);
  };

  const handlePreview = async () => {
    if (!command && !selectedTemplateId) {
      setError('Please enter a command or select a template');
      return;
    }

    setIsPreviewLoading(true);
    setError(null);
    setPreviewResult(null);

    try {
      const result = await testMonitorApi.previewEnhancement(selectedFileKey, {
        command,
        templateId: selectedTemplateId,
        useWebSearch,
        sourceVersion: selectedVersion,
      });

      if (result.status === 'failed') {
        setError(result.errorMessage || 'Enhancement failed');
      } else {
        setPreviewResult(result);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to preview enhancement');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Open the apply modal to get description
  const handleApplyClick = async () => {
    if (!previewResult) return;

    setIsLoading(true);
    setError(null);

    try {
      // First create the enhancement in the database
      const enhanceResult = await testMonitorApi.enhancePrompt(selectedFileKey, {
        command,
        templateId: selectedTemplateId,
        useWebSearch,
        sourceVersion: selectedVersion,
      });

      if (enhanceResult.status === 'failed') {
        setError(enhanceResult.errorMessage || 'Enhancement failed');
        setIsLoading(false);
        return;
      }

      // Store the enhancement ID and show the description modal
      setPendingEnhancementId(enhanceResult.enhancementId);
      setShowApplyModal(true);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create enhancement');
      setIsLoading(false);
    }
  };

  // Actually apply the enhancement with user description
  const handleApplyConfirm = async (description: string) => {
    if (!pendingEnhancementId) return;

    setIsLoading(true);
    setError(null);

    try {
      const applyResult = await testMonitorApi.applyEnhancement(
        selectedFileKey,
        pendingEnhancementId,
        description || undefined // Pass description, or undefined to use auto-generated
      );

      if (applyResult.success) {
        setSuccessMessage(`Created new version ${applyResult.newVersion} successfully!`);
        setPreviewResult(null);
        setCommand('');
        setSelectedTemplateId(undefined);
        setShowApplyModal(false);
        setPendingEnhancementId(null);
        loadVersionHistory();
        loadEnhancementHistory();
        loadQualityScore();
        loadPromptFiles(); // Refresh file list to show new version
      } else {
        setError(applyResult.error || 'Failed to apply enhancement');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to apply enhancement');
    } finally {
      setIsLoading(false);
    }
  };

  // Close apply modal without applying
  const handleApplyCancel = () => {
    setShowApplyModal(false);
    setPendingEnhancementId(null);
  };

  const handleDiscard = () => {
    setPreviewResult(null);
  };

  // Handle selecting an enhancement from the list
  const handleSelectEnhancement = async (enhancementId: string) => {
    // Toggle off if clicking the same one
    if (selectedEnhancementId === enhancementId) {
      setSelectedEnhancementId(null);
      setSelectedEnhancementDetails(null);
      return;
    }

    setSelectedEnhancementId(enhancementId);
    setEnhancementDetailsLoading(true);
    setPreviewResult(null); // Clear any current preview

    try {
      const details = await testMonitorApi.getEnhancement(enhancementId);
      setSelectedEnhancementDetails(details);
    } catch (err: any) {
      setError(err.message || 'Failed to load enhancement details');
      setSelectedEnhancementDetails(null);
    } finally {
      setEnhancementDetailsLoading(false);
    }
  };

  // Handle applying an enhancement from the list
  const handleApplyEnhancementFromList = async (enhancementId: string) => {
    setPendingEnhancementId(enhancementId);
    setShowApplyModal(true);
  };

  // Handle promoting an applied enhancement to production
  const handlePromoteEnhancement = async (enhancementId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const enhancement = enhancementHistory.find(e => e.enhancementId === enhancementId);
      if (!enhancement) {
        throw new Error('Enhancement not found');
      }

      const result = await testMonitorApi.promoteToProduction(
        enhancement.fileKey,
        enhancementId
      );

      if (result.success) {
        setSuccessMessage(`Promoted to production as version ${result.newVersion}!`);
        loadEnhancementHistory();
        loadPromptFiles(); // Refresh to show new version
        loadQualityScore();
      } else {
        setError(result.error || 'Failed to promote enhancement');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to promote enhancement');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle discarding an enhancement from the list
  const handleDiscardEnhancement = async (enhancementId: string) => {
    try {
      // For now, just remove from local state - could add API to discard
      setEnhancementHistory(prev =>
        prev.map(e => e.enhancementId === enhancementId
          ? { ...e, status: 'cancelled' as const }
          : e
        )
      );
      if (selectedEnhancementId === enhancementId) {
        setSelectedEnhancementId(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to discard enhancement');
    }
  };

  // Generate default description for the modal
  const getDefaultDescription = () => {
    const templateName = selectedTemplateId
      ? templates.find(t => t.templateId === selectedTemplateId)?.name
      : null;
    return templateName
      ? `AI Enhancement: ${templateName}`
      : `AI Enhancement: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`;
  };

  const currentFile = promptFiles.find(f => f.fileKey === selectedFileKey);

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Prompting</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Enhance prompts and tools with AI-powered improvements
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-400">×</button>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-2 text-green-500 hover:text-green-700 dark:hover:text-green-400">×</button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex gap-6">
        {/* Left Panel - Prompt Files & AI Enhancements */}
        <div className="w-64 flex-shrink-0 overflow-y-auto p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <PromptFileList
            files={promptFiles}
            selectedFileKey={selectedFileKey}
            loading={filesLoading}
            onSelectFile={setSelectedFileKey}
          />

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <AIEnhancementsList
              enhancements={enhancementHistory}
              selectedEnhancementId={selectedEnhancementId}
              currentPreview={previewResult}
              loading={isPreviewLoading}
              onSelectEnhancement={handleSelectEnhancement}
              onApplyEnhancement={handleApplyEnhancementFromList}
              onPromoteEnhancement={handlePromoteEnhancement}
              onDiscardEnhancement={handleDiscardEnhancement}
            />
          </div>
        </div>

        {/* Middle Panel - Configuration */}
        <div className="w-96 flex-shrink-0 overflow-y-auto p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Currently Selected File - Prominent Indicator */}
          {selectedFileKey && (
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                  {FILE_ICONS[selectedFileKey] || FILE_ICONS.system_prompt}
                </div>
                <div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">
                    Enhancing
                  </div>
                  <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    {FILE_KEY_DISPLAY_NAMES[selectedFileKey] || selectedFileKey}
                  </div>
                </div>
                {currentFile && (
                  <div className="ml-auto">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                      v{currentFile.version}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Version Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Version (optional)
            </label>
            <select
              value={selectedVersion || ''}
              onChange={e => setSelectedVersion(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Current Version</option>
              {versionHistory.map(v => (
                <option key={v.version} value={v.version}>
                  v{v.version} - {v.changeDescription?.substring(0, 40)}...
                </option>
              ))}
            </select>
          </div>

          {/* Templates - Collapsible */}
          <details className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg">
            <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg flex items-center justify-between">
              <span>Quick Templates ({templates.filter(t => t.isBuiltIn).length})</span>
              <svg className="w-4 h-4 transform transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-3 pb-3 pt-2 grid grid-cols-2 gap-2">
              {templates.filter(t => t.isBuiltIn).map(template => (
                <TemplateButton
                  key={template.templateId}
                  template={template}
                  onClick={() => handleTemplateSelect(template)}
                  isSelected={selectedTemplateId === template.templateId}
                />
              ))}
            </div>
          </details>

          {/* Command Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enhancement Command
            </label>
            <textarea
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="Enter your enhancement request, e.g., 'Add better examples for appointment scheduling'"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Web Search Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useWebSearch}
                onChange={e => setUseWebSearch(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Search for best practices</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Include prompt engineering best practices in the enhancement
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={isPreviewLoading || (!command && !selectedTemplateId)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPreviewLoading ? 'Generating...' : 'Preview Enhancement'}
            </button>
          </div>

          {/* Current Quality Score */}
          <div className="mt-6">
            {qualityScoreLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Current Quality</h4>
                <div className="flex items-center justify-center py-6">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Analyzing prompt quality...</p>
                  </div>
                </div>
              </div>
            ) : qualityScore ? (
              <QualityScoreCard score={qualityScore} label="Current Quality" />
            ) : null}
          </div>
        </div>

        {/* Right Panel - Preview & Results */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {isPreviewLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Generating enhancement with Claude Opus...</p>
                {useWebSearch && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Searching for best practices...</p>
                )}
              </div>
            </div>
          ) : enhancementDetailsLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading enhancement details...</p>
              </div>
            </div>
          ) : selectedEnhancementDetails ? (
            <div className="space-y-6">
              {/* Enhancement Header */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-purple-700 dark:text-purple-300">
                    {FILE_KEY_DISPLAY_NAMES[selectedEnhancementDetails.fileKey] || selectedEnhancementDetails.fileKey}
                  </h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    selectedEnhancementDetails.status === 'applied'
                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                      : selectedEnhancementDetails.status === 'promoted'
                      ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                      : 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {selectedEnhancementDetails.status.charAt(0).toUpperCase() + selectedEnhancementDetails.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-purple-600 dark:text-purple-400 mb-2">
                  <strong>Command:</strong> {selectedEnhancementDetails.command}
                </p>
                <div className="flex gap-4 text-xs text-purple-500 dark:text-purple-400">
                  <span>Version: {selectedEnhancementDetails.sourceVersion}</span>
                  <span>Created: {new Date(selectedEnhancementDetails.createdAt).toLocaleString()}</span>
                  {selectedEnhancementDetails.webSearchUsed && <span>Web search used</span>}
                </div>
              </div>

              {/* Quality Scores */}
              {(selectedEnhancementDetails.qualityScoreBefore !== undefined || selectedEnhancementDetails.qualityScoreAfter !== undefined) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Before</h4>
                    <div className="text-3xl font-bold text-gray-600 dark:text-gray-300">
                      {Math.round(selectedEnhancementDetails.qualityScoreBefore || 0)}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">After</h4>
                    <div className="flex items-center gap-2">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {Math.round(selectedEnhancementDetails.qualityScoreAfter || 0)}
                      </div>
                      {selectedEnhancementDetails.qualityScoreBefore !== undefined && selectedEnhancementDetails.qualityScoreAfter !== undefined && (
                        <span className={`text-sm ${
                          selectedEnhancementDetails.qualityScoreAfter > selectedEnhancementDetails.qualityScoreBefore
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {selectedEnhancementDetails.qualityScoreAfter > selectedEnhancementDetails.qualityScoreBefore ? '+' : ''}
                          {Math.round(selectedEnhancementDetails.qualityScoreAfter - selectedEnhancementDetails.qualityScoreBefore)} pts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Reasoning */}
              {selectedEnhancementDetails.aiResponseJson && (() => {
                try {
                  const aiResponse = JSON.parse(selectedEnhancementDetails.aiResponseJson);
                  return aiResponse.reasoning ? (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">AI Reasoning</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{aiResponse.reasoning}</p>
                    </div>
                  ) : null;
                } catch { return null; }
              })()}

              {/* Web Search Results */}
              {selectedEnhancementDetails.webSearchResultsJson && (() => {
                try {
                  const webResults = JSON.parse(selectedEnhancementDetails.webSearchResultsJson);
                  return webResults.length > 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Sources Used</h4>
                      <div className="space-y-2">
                        {webResults.map((result: any, i: number) => (
                          <div key={i} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <div className="font-medium text-gray-700 dark:text-gray-200">{result.title}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{result.source}</div>
                            {result.keyTakeaways && (
                              <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                {result.keyTakeaways.slice(0, 2).map((t: string, j: number) => (
                                  <li key={j}>• {t}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                } catch { return null; }
              })()}

              {/* Enhanced Content Preview */}
              {(selectedEnhancementDetails.appliedContent || selectedEnhancementDetails.aiResponseJson) && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Enhanced Content</h4>
                  <div className="max-h-96 overflow-auto">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                      {selectedEnhancementDetails.appliedContent || (() => {
                        try {
                          const aiResponse = JSON.parse(selectedEnhancementDetails.aiResponseJson || '{}');
                          return aiResponse.enhancedContent || 'No content available';
                        } catch { return 'No content available'; }
                      })()}
                    </pre>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 shadow-lg rounded-lg">
                {selectedEnhancementDetails.status === 'completed' && (
                  <button
                    onClick={() => handleApplyEnhancementFromList(selectedEnhancementDetails.enhancementId)}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Apply Enhancement
                  </button>
                )}
                {selectedEnhancementDetails.status === 'applied' && (
                  <button
                    onClick={() => handlePromoteEnhancement(selectedEnhancementDetails.enhancementId)}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Promote to Production
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedEnhancementId(null);
                    setSelectedEnhancementDetails(null);
                  }}
                  disabled={isLoading}
                  className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
          ) : previewResult ? (
            <div className="space-y-6">
              {/* File Confirmation Banner */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Enhancement Generated for: {FILE_KEY_DISPLAY_NAMES[previewResult.fileKey] || previewResult.fileKey}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quality Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <QualityScoreCard
                  score={{
                    overall: previewResult.qualityScores.before,
                    dimensions: qualityScore?.dimensions || { clarity: 0, completeness: 0, examples: 0, consistency: 0, edgeCases: 0 },
                    suggestions: [],
                  }}
                  label="Before"
                />
                <QualityScoreCard
                  score={{
                    overall: previewResult.qualityScores.after,
                    dimensions: qualityScore?.dimensions || { clarity: 0, completeness: 0, examples: 0, consistency: 0, edgeCases: 0 },
                    suggestions: [],
                  }}
                  label="After"
                  comparison={{
                    before: previewResult.qualityScores.before,
                    after: previewResult.qualityScores.after,
                  }}
                />
              </div>

              {/* Reasoning */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">AI Reasoning</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{previewResult.reasoning}</p>
              </div>

              {/* Web Search Results */}
              {previewResult.webSearchResults && previewResult.webSearchResults.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Sources Used</h4>
                  <div className="space-y-2">
                    {previewResult.webSearchResults.map((result, i) => (
                      <div key={i} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <div className="font-medium text-gray-700 dark:text-gray-200">{result.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{result.source}</div>
                        <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {result.keyTakeaways.slice(0, 2).map((t, j) => (
                            <li key={j}>• {t}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diff View */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Changes</h4>
                <DiffView diff={previewResult.diff} />
              </div>

              {/* Apply/Discard Buttons */}
              <div className="flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 shadow-lg rounded-lg">
                <button
                  onClick={handleApplyClick}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Preparing...' : 'Apply Enhancement'}
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={isLoading}
                  className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Discard
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">✨</div>
                <p>Select a template or enter a command to preview enhancement</p>
                <p className="text-sm mt-2">Or click on an enhancement in the list to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhancement History Panel (Collapsible) */}
      {enhancementHistory.length > 0 && (
        <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <details className="group">
            <summary className="px-6 py-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
              Enhancement History ({enhancementHistory.length})
            </summary>
            <div className="px-6 pb-4 max-h-48 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-2 pt-3">Date</th>
                    <th className="pb-2 pt-3">Command</th>
                    <th className="pb-2 pt-3">Status</th>
                    <th className="pb-2 pt-3">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {enhancementHistory.map(h => (
                    <tr key={h.enhancementId} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="py-2 text-gray-600 dark:text-gray-400">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-gray-700 dark:text-gray-300 truncate max-w-xs">
                        {h.command}
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          h.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          h.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">
                        {h.qualityScoreBefore && h.qualityScoreAfter && (
                          <span className={h.qualityScoreAfter > h.qualityScoreBefore ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {Math.round(h.qualityScoreBefore)} → {Math.round(h.qualityScoreAfter)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* Apply Description Modal */}
      <ApplyDescriptionModal
        isOpen={showApplyModal}
        onClose={handleApplyCancel}
        onConfirm={handleApplyConfirm}
        isLoading={isLoading}
        defaultDescription={getDefaultDescription()}
      />
    </div>
  );
};

export default AIPromptingPage;
