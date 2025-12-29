/**
 * AI Suggestion Panel
 * Slide-over panel for AI-generated goal and constraint suggestions
 */

import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  selectFormData,
  selectAISuggestions,
  selectOriginalGoalDescription,
  requestAISuggestions,
  addGoal,
  addConstraint,
  updateBasicInfo,
} from '../../../store/slices/createGoalTestSlice';
import type { ConversationGoalDTO, TestConstraintDTO } from '../../../types/testMonitor.types';
import type { SuggestionItem } from '../../../types/goalTestWizard.types';

interface AISuggestionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISuggestionPanel({ isOpen, onClose }: AISuggestionPanelProps) {
  const dispatch = useAppDispatch();
  const formData = useAppSelector(selectFormData);
  const aiState = useAppSelector(selectAISuggestions);
  const originalGoalDescription = useAppSelector(selectOriginalGoalDescription);

  const [selectedModel, setSelectedModel] = useState<'fast' | 'standard' | 'detailed'>('standard');
  const [acceptedGoals, setAcceptedGoals] = useState<Set<number>>(new Set());
  const [acceptedConstraints, setAcceptedConstraints] = useState<Set<number>>(new Set());
  const [acceptedInitialMessage, setAcceptedInitialMessage] = useState(false);

  // Reset accepted state when suggestions change
  useEffect(() => {
    setAcceptedGoals(new Set());
    setAcceptedConstraints(new Set());
    setAcceptedInitialMessage(false);
  }, [aiState.suggestions]);

  const handleGenerateSuggestions = () => {
    dispatch(
      requestAISuggestions({
        name: formData.basicInfo.name,
        category: formData.basicInfo.category,
        description: formData.basicInfo.description,
        personaTraits: formData.persona.traits,
        tags: formData.basicInfo.tags,
        model: selectedModel,
        // Pass the original goal description from Step 0 AI Analyzer
        // This ensures the AI Helper generates suggestions aligned with the original intent
        originalGoalDescription: originalGoalDescription || undefined,
      })
    );
  };

  const handleAcceptGoal = (index: number, goal: ConversationGoalDTO) => {
    dispatch(addGoal(goal));
    setAcceptedGoals(new Set([...acceptedGoals, index]));
  };

  const handleAcceptConstraint = (index: number, constraint: TestConstraintDTO) => {
    dispatch(addConstraint(constraint));
    setAcceptedConstraints(new Set([...acceptedConstraints, index]));
  };

  const handleAcceptInitialMessage = (message: string) => {
    dispatch(updateBasicInfo({ initialMessage: message }));
    setAcceptedInitialMessage(true);
  };

  const handleAcceptAll = () => {
    if (!aiState.suggestions) return;

    // Accept all goals
    aiState.suggestions.goals.forEach((goal, index) => {
      if (!acceptedGoals.has(index)) {
        dispatch(addGoal(goal.data));
      }
    });
    setAcceptedGoals(new Set(aiState.suggestions.goals.map((_, i) => i)));

    // Accept all constraints
    aiState.suggestions.constraints.forEach((constraint, index) => {
      if (!acceptedConstraints.has(index)) {
        dispatch(addConstraint(constraint.data));
      }
    });
    setAcceptedConstraints(new Set(aiState.suggestions.constraints.map((_, i) => i)));

    // Accept initial message
    if (aiState.suggestions.initialMessage && !acceptedInitialMessage) {
      dispatch(updateBasicInfo({ initialMessage: aiState.suggestions.initialMessage.message }));
      setAcceptedInitialMessage(true);
    }
  };

  const _getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <div className="w-screen max-w-lg">
          <div className="flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI Suggestions
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Get AI-powered recommendations
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Original Goal Context Banner */}
              {originalGoalDescription && (
                <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                        Original Goal (from AI Analyzer):
                      </p>
                      <p className="text-sm text-purple-600 dark:text-purple-400 italic">
                        "{originalGoalDescription}"
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Model selector and generate button */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-4 mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Model:
                  </label>
                  <div className="flex gap-2">
                    {(['fast', 'standard', 'detailed'] as const).map((model) => (
                      <button
                        key={model}
                        onClick={() => setSelectedModel(model)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          selectedModel === model
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        {model.charAt(0).toUpperCase() + model.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleGenerateSuggestions}
                  disabled={aiState.loading || !formData.basicInfo.name || !formData.basicInfo.category}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg
                           hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
                      Generate Suggestions
                    </>
                  )}
                </button>
                {!formData.basicInfo.name && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Enter a test name to generate suggestions
                  </p>
                )}
              </div>

              {/* Error state */}
              {aiState.error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{aiState.error}</p>
                </div>
              )}

              {/* Suggestions */}
              {aiState.suggestions && (
                <>
                  {/* Accept all button */}
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {aiState.suggestions.goals.length} goals, {aiState.suggestions.constraints.length} constraints
                    </p>
                    <button
                      onClick={handleAcceptAll}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400
                               hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Accept All
                    </button>
                  </div>

                  {/* Reasoning */}
                  <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>AI Reasoning:</strong> {aiState.suggestions.reasoning}
                    </p>
                  </div>

                  {/* Goals */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Suggested Goals
                    </h3>
                    <div className="space-y-3">
                      {aiState.suggestions.goals.map((goal, index) => (
                        <SuggestionCard
                          key={index}
                          type="goal"
                          suggestion={goal}
                          isAccepted={acceptedGoals.has(index)}
                          onAccept={() => handleAcceptGoal(index, goal.data)}
                          getConfidenceBadge={getConfidenceBadge}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Constraints */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Suggested Constraints
                    </h3>
                    <div className="space-y-3">
                      {aiState.suggestions.constraints.map((constraint, index) => (
                        <SuggestionCard
                          key={index}
                          type="constraint"
                          suggestion={constraint}
                          isAccepted={acceptedConstraints.has(index)}
                          onAccept={() => handleAcceptConstraint(index, constraint.data)}
                          getConfidenceBadge={getConfidenceBadge}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Initial Message */}
                  {aiState.suggestions.initialMessage && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Suggested Initial Message
                      </h3>
                      <div className={`p-4 border rounded-lg ${
                        acceptedInitialMessage
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}>
                        <p className="text-gray-900 dark:text-white mb-2">
                          "{aiState.suggestions.initialMessage.message}"
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          {aiState.suggestions.initialMessage.explanation}
                        </p>
                        {!acceptedInitialMessage ? (
                          <button
                            onClick={() => handleAcceptInitialMessage(aiState.suggestions!.initialMessage!.message)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400
                                     hover:bg-green-50 dark:hover:bg-green-900/20 rounded border border-green-300 dark:border-green-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Accept
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Added
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Empty state */}
              {!aiState.loading && !aiState.suggestions && !aiState.error && (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">
                    Click "Generate Suggestions" to get AI-powered recommendations for your test case
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for suggestion cards
interface SuggestionCardProps<T> {
  type: 'goal' | 'constraint';
  suggestion: SuggestionItem<T>;
  isAccepted: boolean;
  onAccept: () => void;
  getConfidenceBadge: (confidence: number) => string;
}

function SuggestionCard<T extends ConversationGoalDTO | TestConstraintDTO>({
  type,
  suggestion,
  isAccepted,
  onAccept,
  getConfidenceBadge,
}: SuggestionCardProps<T>) {
  const isGoal = type === 'goal';
  const data = suggestion.data as any;

  return (
    <div className={`p-4 border rounded-lg ${
      isAccepted
        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConfidenceBadge(suggestion.confidence)}`}>
              {Math.round(suggestion.confidence * 100)}% confidence
            </span>
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
              {isGoal ? data.type : data.type}
            </span>
            {isGoal && data.required && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs">
                Required
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {data.description}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {suggestion.explanation}
          </p>
          {isGoal && data.requiredFields && data.requiredFields.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.requiredFields.map((field: string) => (
                <span key={field} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs">
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {!isAccepted ? (
            <button
              onClick={onAccept}
              className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
              title="Accept suggestion"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          ) : (
            <span className="p-2 text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
