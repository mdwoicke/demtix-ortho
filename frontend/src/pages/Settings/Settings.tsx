/**
 * Settings Page
 * Application settings and cache management
 */

import { useState } from 'react';
import { PageHeader } from '../../components/layout';
import { Card, Button, ConfirmationModal } from '../../components/ui';
import { CopyToPostmanButton } from '../../components/features/postman/CopyToPostmanButton';
import { FlowiseConfigManager, LangfuseConfigManager } from '../../components/features/settings';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectEnvironment, toggleEnvironment } from '../../store/slices/authSlice';
import { refreshAllCaches } from '../../store/slices/referenceSlice';
import { useToast } from '../../hooks';

export function Settings() {
  const dispatch = useAppDispatch();
  const environment = useAppSelector(selectEnvironment);
  const toast = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showProductionWarning, setShowProductionWarning] = useState(false);

  const handleToggleEnvironment = () => {
    // Show warning when switching TO production
    if (environment === 'sandbox') {
      setShowProductionWarning(true);
    } else {
      // Switching to sandbox doesn't need confirmation
      dispatch(toggleEnvironment());
      toast.showSuccess('Switched to sandbox environment');
    }
  };

  const handleConfirmProduction = () => {
    dispatch(toggleEnvironment());
    toast.showSuccess('Switched to production environment');
  };

  const handleRefreshCaches = async () => {
    setIsRefreshing(true);
    try {
      await dispatch(refreshAllCaches()).unwrap();
      toast.showSuccess('Cache refreshed successfully');
    } catch (error) {
      toast.showError('Failed to refresh cache');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage application settings and preferences"
      />

      <div className="space-y-6">
        {/* Environment Settings */}
        <Card>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Environment
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Switch between sandbox (test) and production environments
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Current Environment:
                  <span
                    className={`ml-2 px-3 py-1 rounded-md text-sm font-medium ${
                      environment === 'sandbox'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}
                  >
                    {environment === 'sandbox' ? 'Sandbox' : 'Production'}
                  </span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {environment === 'sandbox'
                    ? 'You are working with test data'
                    : 'You are working with live production data'}
                </p>
              </div>
              <Button onClick={handleToggleEnvironment}>
                Switch to {environment === 'sandbox' ? 'Production' : 'Sandbox'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Flowise Configurations */}
        <Card>
          <FlowiseConfigManager />
        </Card>

        {/* Langfuse Configurations */}
        <Card>
          <LangfuseConfigManager />
        </Card>

        {/* Cache Management */}
        <Card>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Cache Management
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Refresh cached reference data (locations, appointment types, providers)
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Reference Data Cache</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Clear and reload all reference data from the server
                </p>
              </div>
              <Button
                onClick={handleRefreshCaches}
                isLoading={isRefreshing}
                variant="secondary"
              >
                Refresh Cache
              </Button>
            </div>

            {/* Copy Reference Data API Requests */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Copy as cURL
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Copy cURL commands for reference data endpoints
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyToPostmanButton
                  procedure="GetLocations"
                  parameters={{ showDeleted: 'false' }}
                  variant="button"
                  size="sm"
                />
                <CopyToPostmanButton
                  procedure="GetAppointmentTypes"
                  parameters={{ showDeleted: 'false' }}
                  variant="button"
                  size="sm"
                />
                <CopyToPostmanButton
                  procedure="GetChairSchedules"
                  parameters={{}}
                  variant="button"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                About
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Application information
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Application</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">Cloud 9 Ortho CRM</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Version</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Backend API</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">http://localhost:3001/api</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Frontend Framework</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">React 19 + TypeScript</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Production Environment Warning Modal */}
      <ConfirmationModal
        isOpen={showProductionWarning}
        onClose={() => setShowProductionWarning(false)}
        onConfirm={handleConfirmProduction}
        title="Switch to Production?"
        variant="warning"
        confirmText="Yes, Switch to Production"
        cancelText="Stay in Sandbox"
        message={
          <div className="space-y-3 text-left">
            <p className="font-medium text-gray-800 dark:text-gray-200">
              You are about to switch to the <span className="text-green-600 font-semibold">Production</span> environment.
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
              <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  All API calls will affect <strong>real patient data</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  Changes cannot be easily reversed
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  Ensure you have proper authorization
                </li>
              </ul>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to continue?
            </p>
          </div>
        }
      />
    </div>
  );
}
