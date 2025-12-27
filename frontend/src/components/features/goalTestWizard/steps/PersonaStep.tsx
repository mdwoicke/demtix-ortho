/**
 * Persona Step
 * Second step: configure the test persona using PersonaEditor
 */

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import {
  selectFormData,
  selectValidation,
  updatePersona,
} from '../../../../store/slices/createGoalTestSlice';
import { WizardStep, PERSONA_PRESETS } from '../../../../types/goalTestWizard.types';
import { PersonaEditor } from '../../testCases/PersonaEditor';
import type { UserPersonaDTO, DynamicUserPersonaDTO } from '../../../../types/testMonitor.types';

export function PersonaStep() {
  const dispatch = useAppDispatch();
  const { persona } = useAppSelector(selectFormData);
  const validation = useAppSelector(selectValidation);
  const stepValidation = validation[WizardStep.Persona];

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handlePresetSelect = (presetName: string) => {
    const preset = PERSONA_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      dispatch(updatePersona(preset));
      setSelectedPreset(presetName);
    }
  };

  const handlePersonaChange = (updatedPersona: UserPersonaDTO | DynamicUserPersonaDTO) => {
    dispatch(updatePersona(updatedPersona));
    // Clear preset selection since user modified the persona
    if (selectedPreset) {
      const preset = PERSONA_PRESETS.find((p) => p.name === selectedPreset);
      if (preset && JSON.stringify(preset) !== JSON.stringify(updatedPersona)) {
        setSelectedPreset(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Preset Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Quick Start with a Preset
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PERSONA_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handlePresetSelect(preset.name)}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${selectedPreset === preset.name
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {preset.name}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {preset.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {preset.inventory.children.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {preset.inventory.children.length} child{preset.inventory.children.length > 1 ? 'ren' : ''}
                  </span>
                )}
                {preset.inventory.hasInsurance && (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    Has insurance
                  </span>
                )}
                {!preset.inventory.hasInsurance && (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                    No insurance
                  </span>
                )}
              </div>
            </button>
          ))}

          {/* Custom option */}
          <button
            type="button"
            onClick={() => setSelectedPreset(null)}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${selectedPreset === null
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }
            `}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">
                Custom Persona
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create a custom persona with your own settings
            </p>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-gray-50 dark:bg-gray-900 text-sm text-gray-500 dark:text-gray-400">
            Persona Details
          </span>
        </div>
      </div>

      {/* PersonaEditor */}
      <PersonaEditor
        persona={persona}
        onChange={handlePersonaChange}
        readOnly={false}
      />

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
