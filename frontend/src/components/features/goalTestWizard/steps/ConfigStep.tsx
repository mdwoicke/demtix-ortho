/**
 * Config Step
 * Fourth step: configure response settings using ResponseConfigEditor
 */

import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import {
  selectFormData,
  selectValidation,
  updateResponseConfig,
} from '../../../../store/slices/createGoalTestSlice';
import { WizardStep } from '../../../../types/goalTestWizard.types';
import { ResponseConfigEditor } from '../../testCases/ResponseConfigEditor';
import type { ResponseConfigDTO } from '../../../../types/testMonitor.types';

export function ConfigStep() {
  const dispatch = useAppDispatch();
  const { responseConfig } = useAppSelector(selectFormData);
  const validation = useAppSelector(selectValidation);
  const stepValidation = validation[WizardStep.Config];

  const handleConfigChange = (updatedConfig: ResponseConfigDTO) => {
    dispatch(updateResponseConfig(updatedConfig));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Response Configuration
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Configure how the test persona responds during the conversation.
        </p>
      </div>

      <ResponseConfigEditor
        responseConfig={responseConfig}
        onChange={handleConfigChange}
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
