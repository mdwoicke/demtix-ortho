/**
 * Create Goal Test Page
 * Main wrapper page for the goal test creation wizard
 */

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  resetWizard,
  cloneFromTestCase,
  loadDraft,
  selectCreateGoalTestState,
  selectIsSubmitting,
  selectIsDirty,
} from '../../store/slices/createGoalTestSlice';
import { CreateGoalTestWizard } from '../../components/features/goalTestWizard/CreateGoalTestWizard';
import { ROUTES } from '../../utils/constants';

export function CreateGoalTestPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { isComplete, error, isLoading } = useAppSelector(selectCreateGoalTestState);
  const isSubmitting = useAppSelector(selectIsSubmitting);
  const isDirty = useAppSelector(selectIsDirty);

  // Handle URL params for cloning or templates
  const cloneId = searchParams.get('clone');
  const templateId = searchParams.get('template');

  // Initialize wizard on mount
  useEffect(() => {
    // Reset wizard state
    dispatch(resetWizard());

    // Check for clone parameter
    if (cloneId) {
      dispatch(cloneFromTestCase(cloneId));
    } else {
      // Check for saved draft
      dispatch(loadDraft());
    }
  }, [dispatch, cloneId]);

  // Handle successful creation
  useEffect(() => {
    if (isComplete) {
      // Redirect to goal tests dashboard after successful creation
      navigate(ROUTES.TEST_MONITOR_GOAL_CASES);
    }
  }, [isComplete, navigate]);

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isComplete) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isComplete]);

  // Loading state while cloning
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          <p className="text-gray-600 dark:text-gray-400">
            {cloneId ? 'Loading test case for cloning...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Failed to Load
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => {
              dispatch(resetWizard());
              navigate(ROUTES.TEST_MONITOR_CREATE);
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Start Fresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-900">
      <CreateGoalTestWizard templateId={templateId} />
    </div>
  );
}
