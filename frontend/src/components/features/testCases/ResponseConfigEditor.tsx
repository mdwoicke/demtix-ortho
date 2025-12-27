/**
 * ResponseConfigEditor Component
 *
 * Edit response configuration settings for goal-oriented tests.
 * Handles maxTurns, useLlmResponses, and handleUnknownIntents settings.
 */

import React from 'react';
import type { ResponseConfigDTO, TristateValue } from '../../../types/testMonitor.types';

interface ResponseConfigEditorProps {
  responseConfig: ResponseConfigDTO | undefined;
  onChange: (responseConfig: ResponseConfigDTO) => void;
  readOnly?: boolean;
}

// Dice icon component for random option
const DiceIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm2 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm10 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-5 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-5 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm10 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
  </svg>
);

interface TristateOption<T> {
  value: T;
  label: string;
  description: string;
  icon?: 'check' | 'x' | 'dice';
}

const TRISTATE_OPTIONS: TristateOption<TristateValue>[] = [
  { value: true, label: 'Enabled', description: 'Always enabled', icon: 'check' },
  { value: false, label: 'Disabled', description: 'Always disabled', icon: 'x' },
  { value: 'random', label: 'Random', description: 'Randomly selected at test runtime', icon: 'dice' },
];

const UNKNOWN_INTENT_OPTIONS: TristateOption<ResponseConfigDTO['handleUnknownIntents']>[] = [
  { value: 'fail', label: 'Fail Test', description: 'Fail the test if an unknown intent is encountered' },
  { value: 'clarify', label: 'Clarify', description: 'Ask for clarification when intent is unclear' },
  { value: 'generic', label: 'Generic Response', description: 'Provide a generic response for unknown intents' },
  { value: 'random', label: 'Random', description: 'Randomly select behavior at runtime', icon: 'dice' },
];

const DEFAULT_CONFIG: ResponseConfigDTO = {
  maxTurns: 20,
  useLlmResponses: true,
  handleUnknownIntents: 'clarify',
};

export function ResponseConfigEditor({ responseConfig, onChange, readOnly = false }: ResponseConfigEditorProps) {
  // Use default config if responseConfig is undefined
  const config = responseConfig || DEFAULT_CONFIG;

  const updateConfig = (updates: Partial<ResponseConfigDTO>) => {
    if (readOnly) return;
    onChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Response Configuration
        </h4>
      </div>

      {/* Max Turns Setting */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Maximum Turns
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Limit the number of conversation turns before test timeout
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={config.maxTurns}
              onChange={(e) => updateConfig({ maxTurns: parseInt(e.target.value) || 20 })}
              min={1}
              max={100}
              disabled={readOnly}
              className="w-20 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">turns</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={config.maxTurns}
            onChange={(e) => updateConfig({ maxTurns: parseInt(e.target.value) })}
            min={5}
            max={50}
            disabled={readOnly}
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>5</span>
          <span>25</span>
          <span>50</span>
        </div>
      </div>

      {/* Use LLM Responses Dropdown */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Use LLM Responses
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Enable AI-generated responses for more realistic testing
        </p>
        <div className="space-y-2">
          {TRISTATE_OPTIONS.map((option) => (
            <label
              key={String(option.value)}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                config.useLlmResponses === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              } ${readOnly ? 'cursor-not-allowed opacity-75' : ''}`}
            >
              <input
                type="radio"
                name="useLlmResponses"
                checked={config.useLlmResponses === option.value}
                onChange={() => updateConfig({ useLlmResponses: option.value })}
                disabled={readOnly}
                className="sr-only"
              />
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                config.useLlmResponses === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {option.icon === 'check' && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {option.icon === 'x' && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {option.icon === 'dice' && <DiceIcon />}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Handle Unknown Intents */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Handle Unknown Intents
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          How should the test handle unrecognized user intents?
        </p>
        <div className="space-y-2">
          {UNKNOWN_INTENT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                config.handleUnknownIntents === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              } ${readOnly ? 'cursor-not-allowed opacity-75' : ''}`}
            >
              <input
                type="radio"
                name="handleUnknownIntents"
                value={option.value}
                checked={config.handleUnknownIntents === option.value}
                onChange={(e) => updateConfig({ handleUnknownIntents: e.target.value as ResponseConfigDTO['handleUnknownIntents'] })}
                disabled={readOnly}
                className="sr-only"
              />
              {option.icon === 'dice' && (
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  config.handleUnknownIntents === option.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  <DiceIcon />
                </div>
              )}
              {!option.icon && (
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  config.handleUnknownIntents === option.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  <span className="text-xs font-medium">
                    {option.value === 'fail' && '!'}
                    {option.value === 'clarify' && '?'}
                    {option.value === 'generic' && '...'}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-1">Response Configuration Tips</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Set a reasonable max turns to prevent runaway conversations</li>
              <li>Enable LLM responses for more realistic test scenarios</li>
              <li>Use "Random" (dice icon) to add variability and test different behaviors</li>
              <li>Random options are resolved at test runtime for each execution</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResponseConfigEditor;
