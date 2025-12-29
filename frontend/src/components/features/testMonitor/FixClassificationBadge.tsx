/**
 * FixClassificationBadge Component
 * Displays the classification of a fix as Bot Issue, Test Agent Issue, or Both
 * Based on the "Golden Rule" from the iva-prompt-tuning skill
 */

import type { FixClassification } from '../../../types/testMonitor.types';

interface FixClassificationBadgeProps {
  classification?: FixClassification;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
}

// Classification styles following the plan's color scheme
const CLASSIFICATION_STYLES = {
  bot: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    label: 'Bot Issue',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    description: 'The chatbot needs to be fixed. Real users would behave this way.',
  },
  'test-agent': {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    label: 'Test Agent',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    description: 'The test agent is unrealistic. Real users wouldn\'t behave this way.',
  },
  both: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    label: 'Both',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    description: 'Both systems have issues. Fix the bot first!',
  },
} as const;

export function FixClassificationBadge({
  classification,
  size = 'sm',
  showTooltip = true,
}: FixClassificationBadgeProps) {
  if (!classification) {
    return (
      <span className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400
        text-xs
      `}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Unknown
      </span>
    );
  }

  const style = CLASSIFICATION_STYLES[classification.issueLocation];
  const confidencePercent = Math.round(classification.confidence * 100);
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <div className="relative inline-block group">
      <span
        className={`
          inline-flex items-center gap-1 rounded-full border
          ${sizeClasses}
          ${style.bg} ${style.text} ${style.border}
          font-medium
        `}
      >
        {style.icon}
        <span>{style.label}</span>
        {size === 'md' && (
          <span className="opacity-70 text-[10px]">
            {confidencePercent}%
          </span>
        )}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div className="
          absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
          w-64 p-3 rounded-lg shadow-lg
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          opacity-0 invisible group-hover:opacity-100 group-hover:visible
          transition-all duration-200
          text-sm
        ">
          {/* Arrow */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700" />

          <div className="relative">
            <p className={`font-medium mb-1 ${style.text}`}>
              {style.label} Issue ({confidencePercent}% confidence)
            </p>
            <p className="text-gray-600 dark:text-gray-300 text-xs mb-2">
              {style.description}
            </p>

            <div className="text-xs space-y-1 border-t border-gray-100 dark:border-gray-700 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">User behavior realistic:</span>
                <span className={classification.userBehaviorRealistic ? 'text-green-600' : 'text-red-600'}>
                  {classification.userBehaviorRealistic ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Bot response appropriate:</span>
                <span className={classification.botResponseAppropriate ? 'text-green-600' : 'text-red-600'}>
                  {classification.botResponseAppropriate ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {classification.reasoning && (
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-2 italic">
                "{classification.reasoning}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FixClassificationBadge;
