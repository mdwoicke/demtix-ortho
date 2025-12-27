/**
 * Wizard Navigation
 * Bottom navigation bar with Back, Next, and Submit buttons
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  selectCurrentStep,
  selectCanProceed,
  selectIsFormValid,
  selectIsSubmitting,
  selectIsDirty,
  nextStep,
  prevStep,
  submitGoalTest,
  saveDraft,
  resetWizard,
} from '../../../store/slices/createGoalTestSlice';
import { WizardStep, WIZARD_STEPS } from '../../../types/goalTestWizard.types';
import { ROUTES } from '../../../utils/constants';
import { Button } from '../../ui/Button';

export function WizardNavigation() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const currentStep = useAppSelector(selectCurrentStep);
  const canProceed = useAppSelector(selectCanProceed);
  const isFormValid = useAppSelector(selectIsFormValid);
  const isSubmitting = useAppSelector(selectIsSubmitting);
  const isDirty = useAppSelector(selectIsDirty);

  const isFirstStep = currentStep === WizardStep.Analyzer;
  const isLastStep = currentStep === WizardStep.Review;
  const isAnalyzerStep = currentStep === WizardStep.Analyzer;

  const handleBack = () => {
    dispatch(prevStep());
  };

  const handleNext = () => {
    dispatch(nextStep());
  };

  const handleSubmit = async () => {
    try {
      await dispatch(submitGoalTest()).unwrap();
    } catch (error) {
      // Error is handled in the slice
      console.error('Failed to submit:', error);
    }
  };

  const handleSaveDraft = () => {
    dispatch(saveDraft());
  };

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmed) return;
    }
    dispatch(resetWizard());
    navigate(ROUTES.TEST_MONITOR_GOAL_CASES);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Left side - Cancel and Save Draft */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          {isDirty && (
            <Button variant="secondary" onClick={handleSaveDraft}>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              Save Draft
            </Button>
          )}
        </div>

        {/* Right side - Navigation */}
        <div className="flex items-center gap-3">
          {/* Step indicator */}
          <span className="text-sm text-gray-500 dark:text-gray-400 mr-4">
            Step {currentStep + 1} of {WIZARD_STEPS.length}
          </span>

          {/* Back button */}
          {!isFirstStep && (
            <Button variant="secondary" onClick={handleBack}>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </Button>
          )}

          {/* Next or Submit button */}
          {isLastStep ? (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              isLoading={isSubmitting}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Create Test
            </Button>
          ) : isAnalyzerStep ? (
            // Analyzer step has its own navigation (Skip/Accept buttons)
            <span className="text-sm text-gray-400 dark:text-gray-500 italic">
              Use buttons above to continue
            </span>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed}
            >
              Next
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
