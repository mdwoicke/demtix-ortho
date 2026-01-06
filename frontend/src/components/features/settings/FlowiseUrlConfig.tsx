/**
 * FlowiseUrlConfig Component
 * Configure the production Flowise endpoint URL and API key in app settings
 */

import { useState, useEffect } from 'react';
import { Spinner } from '../../ui';
import { cn } from '../../../utils/cn';
import {
  getAppSettings,
  updateAppSettings,
  testProductionFlowiseConnection,
} from '../../../services/api/appSettingsApi';
import type { AppSettings } from '../../../types/appSettings.types';

interface FlowiseUrlConfigProps {
  className?: string;
}

export function FlowiseUrlConfig({ className }: FlowiseUrlConfigProps) {
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalEndpoint, setOriginalEndpoint] = useState('');
  const [originalApiKeySet, setOriginalApiKeySet] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings: AppSettings = await getAppSettings();
      const endpointValue = settings.flowiseProductionUrl?.value || '';
      setEndpoint(endpointValue);
      setOriginalEndpoint(endpointValue);
      setOriginalApiKeySet(settings.flowiseProductionApiKey?.hasValue || false);
      // API key is masked, so we don't set it - only show if it has a value
      if (settings.flowiseProductionApiKey?.hasValue) {
        setApiKey('********');
      }
    } catch (error) {
      console.error('Failed to load app settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkForChanges = (newEndpoint: string, newApiKey: string) => {
    const endpointChanged = newEndpoint !== originalEndpoint;
    const apiKeyChanged = newApiKey !== '********' && newApiKey !== '';
    setHasChanges(endpointChanged || apiKeyChanged);
  };

  const handleEndpointChange = (value: string) => {
    setEndpoint(value);
    checkForChanges(value, apiKey);
    setTestResult(null);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    checkForChanges(endpoint, value);
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    try {
      const updates: Record<string, string> = {};

      if (endpoint !== originalEndpoint) {
        updates.flowiseProductionUrl = endpoint;
      }

      // Only update API key if it's not the masked placeholder
      if (apiKey !== '********' && apiKey !== '') {
        updates.flowiseProductionApiKey = apiKey;
      }

      await updateAppSettings(updates);
      setOriginalEndpoint(endpoint);
      if (apiKey !== '********') {
        setOriginalApiKeySet(!!apiKey);
      }
      setHasChanges(false);
      setTestResult({ success: true, message: 'Settings saved successfully' });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (isTesting) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // If there are unsaved changes, save first
      if (hasChanges) {
        await handleSave();
      }

      const result = await testProductionFlowiseConnection();
      setTestResult({
        success: result.success,
        message: result.success
          ? (result.responseTimeMs ? `Endpoint reachable (${result.responseTimeMs}ms)` : 'Endpoint is reachable')
          : (result.message || 'Connection failed'),
      });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <Spinner size="md" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Production Flowise Endpoint
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure the Flowise endpoint used for e2e testing and production comparisons
          </p>
        </div>
        {originalEndpoint && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Configured
          </span>
        )}
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
        {/* Endpoint URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Prediction API URL
          </label>
          <input
            type="url"
            value={endpoint}
            onChange={(e) => handleEndpointChange(e.target.value)}
            placeholder="https://flowise.example.com/api/v1/prediction/..."
            disabled={isSaving}
            className={cn(
              'w-full px-3 py-2 text-sm border rounded-lg transition-colors',
              'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
              'placeholder-gray-400 dark:placeholder-gray-500',
              'border-gray-300 dark:border-gray-600',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              isSaving && 'opacity-50 cursor-not-allowed'
            )}
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            API Key (optional)
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Enter API key if required..."
              disabled={isSaving}
              className={cn(
                'w-full px-3 py-2 pr-10 text-sm border rounded-lg transition-colors',
                'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
                'placeholder-gray-400 dark:placeholder-gray-500',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                isSaving && 'opacity-50 cursor-not-allowed'
              )}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiKey ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleTest}
            disabled={!endpoint || isTesting || isSaving}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'hover:bg-gray-300 dark:hover:bg-gray-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {isTesting ? (
              <>
                <Spinner size="sm" />
                Testing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Test Connection
              </>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {isSaving ? (
              <>
                <Spinner size="sm" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save
              </>
            )}
          </button>
        </div>

        {/* Test/Save Result */}
        {testResult && (
          <div className={cn(
            'px-4 py-3 text-sm rounded-lg flex items-center gap-2',
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          )}>
            {testResult.success ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {testResult.message}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        This endpoint is used by the test-agent for running e2e tests and production comparison runs.
      </p>
    </div>
  );
}
