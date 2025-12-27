/**
 * WorkflowIndicator Component
 * Shows the 4-step tuning workflow with current progress
 * Part of Phase 6 of the Advanced Tuning Tab implementation
 */

import React from 'react';
import { cn } from '../../../utils/cn';

export interface WorkflowStep {
  id: string;
  label: string;
  status: 'completed' | 'in_progress' | 'pending';
  count?: number;
}

interface WorkflowIndicatorProps {
  steps: WorkflowStep[];
  className?: string;
}

const stepStatusStyles = {
  completed: {
    bg: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-500',
    connector: 'bg-green-500',
    icon: (
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  in_progress: {
    bg: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500',
    connector: 'bg-gray-300 dark:bg-gray-600',
    icon: (
      <div className="w-4 h-4 flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      </div>
    ),
  },
  pending: {
    bg: 'bg-gray-300 dark:bg-gray-600',
    text: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-300 dark:border-gray-600',
    connector: 'bg-gray-300 dark:bg-gray-600',
    icon: null,
  },
};

export function WorkflowIndicator({ steps, className }: WorkflowIndicatorProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const style = stepStatusStyles[step.status];
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            {/* Step circle and label */}
            <div className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2',
                  style.bg,
                  style.border
                )}
              >
                {style.icon || (
                  <span className="text-xs font-bold text-white">{index + 1}</span>
                )}
              </div>

              {/* Label */}
              <div className="mt-2 text-center">
                <span className={cn('text-xs font-medium', style.text)}>
                  {step.label}
                </span>
                {step.count !== undefined && step.count > 0 && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                      step.status === 'completed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : step.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    {step.count}
                  </span>
                )}
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  // Use completed style if current step is completed
                  step.status === 'completed' ? style.connector : 'bg-gray-300 dark:bg-gray-600'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default WorkflowIndicator;
