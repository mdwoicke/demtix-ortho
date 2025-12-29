/**
 * Review Step
 * Final step: review all settings before creating the test
 */

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import {
  selectFormData,
  selectValidation,
  selectIsFormValid,
  selectCreateGoalTestState,
  selectSubmitError,
  setStep,
} from '../../../../store/slices/createGoalTestSlice';
import { WizardStep } from '../../../../types/goalTestWizard.types';
import { CATEGORY_STYLES, GOAL_TYPES } from '../../../../types/testMonitor.types';

// Helper type for dynamic field specs
interface DynamicFieldSpec {
  _dynamic: true;
  fieldType: string;
  constraints?: unknown;
}

// Type guard for dynamic field specs
function isDynamicField(value: unknown): value is DynamicFieldSpec {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_dynamic' in value &&
    (value as DynamicFieldSpec)._dynamic === true
  );
}

// Helper to render a field value that may be static or dynamic
function renderFieldValue(value: string | DynamicFieldSpec | undefined): string {
  if (value === undefined || value === null) {
    return '(not set)';
  }
  if (isDynamicField(value)) {
    return `[Dynamic: ${value.fieldType}]`;
  }
  return String(value) || '(not set)';
}

export function ReviewStep() {
  const dispatch = useAppDispatch();
  const formData = useAppSelector(selectFormData);
  const validation = useAppSelector(selectValidation);
  const { generatedCaseId, source } = useAppSelector(selectCreateGoalTestState);
  const isFormValid = useAppSelector(selectIsFormValid);
  const submitError = useAppSelector(selectSubmitError);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['basicInfo', 'persona', 'goals', 'config'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const goToStep = (step: WizardStep) => {
    dispatch(setStep(step));
  };

  const categoryStyles = CATEGORY_STYLES[formData.basicInfo.category];

  // Check for validation issues
  const validationIssues: { step: WizardStep; label: string; errors: string[] }[] = [];

  if (!validation[WizardStep.BasicInfo].isValid) {
    validationIssues.push({
      step: WizardStep.BasicInfo,
      label: 'Basic Info',
      errors: validation[WizardStep.BasicInfo].errors,
    });
  }
  if (!validation[WizardStep.Persona].isValid) {
    validationIssues.push({
      step: WizardStep.Persona,
      label: 'Persona',
      errors: validation[WizardStep.Persona].errors,
    });
  }
  if (!validation[WizardStep.Goals].isValid) {
    validationIssues.push({
      step: WizardStep.Goals,
      label: 'Goals',
      errors: validation[WizardStep.Goals].errors,
    });
  }
  if (!validation[WizardStep.Config].isValid) {
    validationIssues.push({
      step: WizardStep.Config,
      label: 'Config',
      errors: validation[WizardStep.Config].errors,
    });
  }

  const SectionHeader = ({
    title,
    section,
    step,
    isValid,
  }: {
    title: string;
    section: string;
    step: WizardStep;
    isValid: boolean;
  }) => (
    <div
      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center ${
            isValid ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
          }`}
        >
          {isValid ? (
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToStep(step);
          }}
          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          Edit
        </button>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            expandedSections.has(section) ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Submit Error */}
      {submitError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
            Failed to create test
          </h4>
          <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
        </div>
      )}

      {/* Validation Issues Summary */}
      {!isFormValid && validationIssues.length > 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Please complete the following sections before creating the test:
          </h4>
          <ul className="space-y-2">
            {validationIssues.map((issue) => (
              <li key={issue.step} className="flex items-start gap-2">
                <button
                  onClick={() => goToStep(issue.step)}
                  className="text-sm text-yellow-700 dark:text-yellow-300 underline hover:no-underline"
                >
                  {issue.label}
                </button>
                <span className="text-sm text-yellow-600 dark:text-yellow-400">
                  - {issue.errors[0]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ready to Create */}
      {isFormValid && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              All steps completed! You can now create this test.
            </span>
          </div>
        </div>
      )}

      {/* Basic Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <SectionHeader
          title="Basic Information"
          section="basicInfo"
          step={WizardStep.BasicInfo}
          isValid={validation[WizardStep.BasicInfo].isValid}
        />
        {expandedSections.has('basicInfo') && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Case ID</span>
                <p className="font-mono text-gray-900 dark:text-white">{generatedCaseId}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Category</span>
                <p>
                  <span className={`inline-flex px-2 py-1 rounded text-sm ${categoryStyles.badge}`}>
                    {formData.basicInfo.category}
                  </span>
                </p>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
              <p className="text-gray-900 dark:text-white">{formData.basicInfo.name || '(not set)'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Description</span>
              <p className="text-gray-900 dark:text-white">{formData.basicInfo.description || '(not set)'}</p>
            </div>
            {formData.basicInfo.tags.length > 0 && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Tags</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {formData.basicInfo.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {formData.basicInfo.initialMessage && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Initial Message</span>
                <p className="text-gray-900 dark:text-white italic">"{formData.basicInfo.initialMessage}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persona Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <SectionHeader
          title="Test Persona"
          section="persona"
          step={WizardStep.Persona}
          isValid={validation[WizardStep.Persona].isValid}
        />
        {expandedSections.has('persona') && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Persona Name</span>
                <p className="text-gray-900 dark:text-white">{formData.persona.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Parent</span>
                <p className="text-gray-900 dark:text-white">
                  {renderFieldValue(formData.persona.inventory.parentFirstName)} {renderFieldValue(formData.persona.inventory.parentLastName)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
                <p className="text-gray-900 dark:text-white">{renderFieldValue(formData.persona.inventory.parentPhone)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Children</span>
                <p className="text-gray-900 dark:text-white">
                  {formData.persona.inventory.children.map((c) => renderFieldValue(c.firstName)).join(', ')}
                </p>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Traits</span>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm">
                  {formData.persona.traits.verbosity}
                </span>
                {formData.persona.traits.providesExtraInfo && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-sm">
                    provides extra info
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Goals Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <SectionHeader
          title={`Goals (${formData.goals.length})`}
          section="goals"
          step={WizardStep.Goals}
          isValid={validation[WizardStep.Goals].isValid}
        />
        {expandedSections.has('goals') && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {formData.goals.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 italic">No goals defined</p>
            ) : (
              <div className="space-y-2">
                {formData.goals.map((goal, index) => {
                  const goalType = GOAL_TYPES.find((g) => g.value === goal.type);
                  return (
                    <div
                      key={goal.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {index + 1}. {goalType?.label || goal.type}
                        </span>
                        {goal.required && (
                          <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{goal.description}</p>
                      {goal.requiredFields && goal.requiredFields.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {goal.requiredFields.map((field) => (
                            <span
                              key={field}
                              className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {formData.constraints.length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Constraints ({formData.constraints.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {formData.constraints.map((constraint, index) => (
                    <div
                      key={index}
                      className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">
                        {constraint.description}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          constraint.severity === 'critical'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : constraint.severity === 'high'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                              : constraint.severity === 'medium'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {constraint.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Config Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <SectionHeader
          title="Response Configuration"
          section="config"
          step={WizardStep.Config}
          isValid={validation[WizardStep.Config].isValid}
        />
        {expandedSections.has('config') && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Max Turns</span>
                <p className="text-gray-900 dark:text-white">{formData.responseConfig.maxTurns}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Use LLM Responses</span>
                <p className="text-gray-900 dark:text-white">
                  {formData.responseConfig.useLlmResponses ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Unknown Intents</span>
                <p className="text-gray-900 dark:text-white capitalize">
                  {formData.responseConfig.handleUnknownIntents}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Source Info */}
      {source.type !== 'blank' && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {source.type === 'clone' && `Cloned from ${source.name}`}
          {source.type === 'template' && `Based on template: ${source.name}`}
          {source.type === 'ai-analyzed' && (
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Generated by AI Analysis
            </span>
          )}
        </div>
      )}
    </div>
  );
}
