/**
 * Basic Info Step
 * First step of the wizard: name, description, category, tags, initial message
 */

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import {
  selectFormData,
  selectValidation,
  updateBasicInfo,
  selectCreateGoalTestState,
} from '../../../../store/slices/createGoalTestSlice';
import { WizardStep } from '../../../../types/goalTestWizard.types';
import type { TestCategory } from '../../../../types/testMonitor.types';
import { CATEGORY_STYLES } from '../../../../types/testMonitor.types';

export function BasicInfoStep() {
  const dispatch = useAppDispatch();
  const { basicInfo } = useAppSelector(selectFormData);
  const validation = useAppSelector(selectValidation);
  const { generatedCaseId } = useAppSelector(selectCreateGoalTestState);
  const stepValidation = validation[WizardStep.BasicInfo];

  const [tagInput, setTagInput] = useState('');

  const categories: { value: TestCategory; label: string; description: string }[] = [
    {
      value: 'happy-path',
      label: 'Happy Path',
      description: 'Standard successful flows that complete as expected',
    },
    {
      value: 'edge-case',
      label: 'Edge Case',
      description: 'Unusual but valid scenarios that test boundaries',
    },
    {
      value: 'error-handling',
      label: 'Error Handling',
      description: 'Error conditions and recovery scenarios',
    },
  ];

  const handleAddTag = () => {
    if (tagInput.trim() && !basicInfo.tags.includes(tagInput.trim())) {
      dispatch(updateBasicInfo({ tags: [...basicInfo.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    dispatch(updateBasicInfo({ tags: basicInfo.tags.filter((t) => t !== tag) }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="space-y-6">
      {/* Case ID (auto-generated) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Case ID
        </label>
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-mono">
            {generatedCaseId || 'GOAL-XXX-000'}
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Auto-generated based on category
          </span>
        </div>
      </div>

      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Test Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={basicInfo.name}
          onChange={(e) => dispatch(updateBasicInfo({ name: e.target.value }))}
          placeholder="e.g., New Patient Booking - Single Child"
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A clear, descriptive name for this test case (3-100 characters)
        </p>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          value={basicInfo.description}
          onChange={(e) => dispatch(updateBasicInfo({ description: e.target.value }))}
          placeholder="Describe what this test case validates..."
          rows={3}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Explain the purpose and expected behavior (10-500 characters)
        </p>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Category <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const isSelected = basicInfo.category === cat.value;
            const styles = CATEGORY_STYLES[cat.value];

            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => dispatch(updateBasicInfo({ category: cat.value }))}
                className={`
                  p-4 rounded-lg border-2 text-left transition-all
                  ${isSelected
                    ? `${styles.border.replace('border-l-4', 'border-2')} ${styles.header}`
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isSelected ? styles.icon.replace('text-', 'bg-') : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                  <span className={`font-medium ${isSelected ? styles.text : 'text-gray-900 dark:text-white'}`}>
                    {cat.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {cat.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label
          htmlFor="tags"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Tags
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a tag and press Enter"
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200
                       rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
          >
            Add
          </button>
        </div>
        {basicInfo.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {basicInfo.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 dark:bg-primary-900/30
                           text-primary-700 dark:text-primary-300 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-primary-900 dark:hover:text-primary-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Initial Message */}
      <div>
        <label
          htmlFor="initialMessage"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Initial Message
        </label>
        <textarea
          id="initialMessage"
          value={basicInfo.initialMessage}
          onChange={(e) => dispatch(updateBasicInfo({ initialMessage: e.target.value }))}
          placeholder="The first message the test persona will send (optional - leave blank for default greeting)"
          rows={2}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Optional: The first message the test persona sends. Leave blank for a default greeting.
        </p>
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
