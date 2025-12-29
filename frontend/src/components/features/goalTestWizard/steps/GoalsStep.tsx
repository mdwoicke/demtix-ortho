/**
 * Goals Step
 * Third step: configure goals and constraints using GoalsEditor and ConstraintsEditor
 */

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import {
  selectFormData,
  selectValidation,
  selectAISuggestions,
  updateGoals,
  updateConstraints,
} from '../../../../store/slices/createGoalTestSlice';
import { WizardStep } from '../../../../types/goalTestWizard.types';
import { GoalsEditor } from '../../testCases/GoalsEditor';
import { ConstraintsEditor } from '../../testCases/ConstraintsEditor';
import { AISuggestionPanel } from '../AISuggestionPanel';
import type { ConversationGoalDTO, TestConstraintDTO } from '../../../../types/testMonitor.types';

export function GoalsStep() {
  const dispatch = useAppDispatch();
  const { goals, constraints, basicInfo } = useAppSelector(selectFormData);
  const validation = useAppSelector(selectValidation);
  const aiState = useAppSelector(selectAISuggestions);
  const stepValidation = validation[WizardStep.Goals];

  const [showAIPanel, setShowAIPanel] = useState(false);

  const handleGoalsChange = (updatedGoals: ConversationGoalDTO[]) => {
    dispatch(updateGoals(updatedGoals));
  };

  const handleConstraintsChange = (updatedConstraints: TestConstraintDTO[]) => {
    dispatch(updateConstraints(updatedConstraints));
  };

  return (
    <div className="space-y-8">
      {/* AI Suggestion Button */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
              Need help creating goals?
            </h4>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              Let AI suggest goals and constraints based on your test case
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAIPanel(true)}
          disabled={!basicInfo.name}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700
                   disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {aiState.loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Get AI Suggestions
            </>
          )}
        </button>
      </div>

      {/* Goals Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Goals <span className="text-red-500">*</span>
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Define what the test should achieve. At least one goal is required.
            </p>
          </div>
        </div>
        <GoalsEditor
          goals={goals}
          onChange={handleGoalsChange}
          readOnly={false}
        />
      </div>

      {/* AI Suggestion Panel */}
      <AISuggestionPanel
        isOpen={showAIPanel}
        onClose={() => setShowAIPanel(false)}
      />

      {/* Constraints Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Constraints
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set boundaries and requirements for the test execution.
            </p>
          </div>
        </div>
        <ConstraintsEditor
          constraints={constraints}
          onChange={handleConstraintsChange}
          readOnly={false}
        />
      </div>

      {/* Validation Errors */}
      {stepValidation.touched && stepValidation.errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            Please fix the following errors:
          </h4>
          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
            {stepValidation.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
