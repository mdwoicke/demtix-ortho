/**
 * TristateToggle Component
 *
 * A three-state toggle for boolean fields that supports:
 * - true (Enabled/Yes)
 * - false (Disabled/No)
 * - 'random' (Randomly selected at runtime)
 *
 * Displays as a compact horizontal button group with dice icon for random.
 */

import type { TristateValue } from '../../../types/testMonitor.types';

// Dice icon component
const DiceIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm2 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm10 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-5 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-5 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm10 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
  </svg>
);

interface TristateToggleProps {
  label: string;
  value: TristateValue;
  onChange: (value: TristateValue) => void;
  disabled?: boolean;
  /** Custom labels for true/false states */
  trueLabel?: string;
  falseLabel?: string;
  /** Show as compact inline style */
  compact?: boolean;
  /** Description shown below label */
  description?: string;
}

export function TristateToggle({
  label,
  value,
  onChange,
  disabled = false,
  trueLabel = 'Yes',
  falseLabel = 'No',
  compact = false,
  description,
}: TristateToggleProps) {
  const options: { value: TristateValue; label: string; icon?: 'check' | 'x' | 'dice' }[] = [
    { value: true, label: trueLabel, icon: 'check' },
    { value: false, label: falseLabel, icon: 'x' },
    { value: 'random', label: '', icon: 'dice' },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-400 min-w-0 flex-shrink-0">
          {label}
        </span>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => !disabled && onChange(option.value)}
              disabled={disabled}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                value === option.value
                  ? option.icon === 'dice'
                    ? 'bg-purple-500 text-white'
                    : option.value === true
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} border-r border-gray-300 dark:border-gray-600 last:border-r-0`}
              title={option.icon === 'dice' ? 'Random (decided at runtime)' : option.label}
            >
              {option.icon === 'check' && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {option.icon === 'x' && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {option.icon === 'dice' && <DiceIcon className="w-3.5 h-3.5" />}
              {option.label && <span>{option.label}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden w-fit">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              value === option.value
                ? option.icon === 'dice'
                  ? 'bg-purple-500 text-white'
                  : option.value === true
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} border-r border-gray-300 dark:border-gray-600 last:border-r-0`}
            title={option.icon === 'dice' ? 'Random (decided at runtime)' : option.label}
          >
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
            {option.icon === 'dice' && <DiceIcon className="w-4 h-4" />}
            {option.label && <span>{option.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default TristateToggle;
