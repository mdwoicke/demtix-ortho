/**
 * LangfuseConfigManager Component
 * Manages multiple Langfuse configuration profiles
 */

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '../../ui';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { cn } from '../../../utils/cn';
import { ConfigProfileCard } from './ConfigProfileCard';
import { ConfigProfileModal, type ConfigField } from './ConfigProfileModal';
import {
  getLangfuseConfigs,
  createLangfuseConfig,
  updateLangfuseConfig,
  deleteLangfuseConfig,
  setLangfuseConfigDefault,
  testLangfuseConfigConnection,
} from '../../../services/api/appSettingsApi';
import type { LangfuseConfigProfile } from '../../../types/appSettings.types';

const LANGFUSE_FIELDS: ConfigField[] = [
  {
    key: 'name',
    label: 'Configuration Name',
    type: 'text',
    required: true,
    placeholder: 'e.g., Production, Staging, Development',
  },
  {
    key: 'host',
    label: 'Host URL',
    type: 'url',
    required: true,
    placeholder: 'https://langfuse.example.com',
  },
  {
    key: 'publicKey',
    label: 'Public Key',
    type: 'text',
    required: true,
    placeholder: 'pk-lf-...',
  },
  {
    key: 'secretKey',
    label: 'Secret Key',
    type: 'password',
    required: false,
    placeholder: 'sk-lf-...',
  },
];

interface LangfuseConfigManagerProps {
  className?: string;
}

export function LangfuseConfigManager({ className }: LangfuseConfigManagerProps) {
  const [configs, setConfigs] = useState<LangfuseConfigProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LangfuseConfigProfile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LangfuseConfigProfile | null>(null);

  // Load configs on mount
  const loadConfigs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLangfuseConfigs();
      setConfigs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load configurations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Handlers
  const handleCreate = () => {
    setEditingConfig(null);
    setIsModalOpen(true);
  };

  const handleEdit = (config: LangfuseConfigProfile) => {
    setEditingConfig(config);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Record<string, string | boolean>) => {
    const payload = {
      name: data.name as string,
      host: data.host as string,
      publicKey: data.publicKey as string,
      secretKey: data.secretKey as string | undefined,
      isDefault: data.isDefault as boolean,
    };

    if (editingConfig) {
      await updateLangfuseConfig(editingConfig.id, payload);
    } else {
      await createLangfuseConfig(payload);
    }

    await loadConfigs();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteLangfuseConfig(deleteConfirm.id);
      await loadConfigs();
    } catch (err: any) {
      setError(err.message || 'Failed to delete configuration');
    }
    setDeleteConfirm(null);
  };

  const handleSetDefault = async (id: number) => {
    try {
      await setLangfuseConfigDefault(id);
      await loadConfigs();
    } catch (err: any) {
      setError(err.message || 'Failed to set default configuration');
    }
  };

  const handleTest = async (id: number) => {
    return await testLangfuseConfigConnection(id);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Spinner size="md" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading configurations...</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Langfuse Configurations
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage multiple Langfuse instances for prompt management and tracing
          </p>
        </div>
        <button
          onClick={handleCreate}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'flex items-center gap-1'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Configuration List */}
      {configs.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No configurations found. Click "Add New" to create one.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {configs.map((config) => (
            <ConfigProfileCard
              key={config.id}
              id={config.id}
              name={config.name}
              primaryValue={config.host}
              primaryLabel="Host"
              secondaryValue={config.publicKey}
              secondaryLabel="Public Key"
              hasSecret={config.hasSecretKey}
              isDefault={config.isDefault}
              onEdit={() => handleEdit(config)}
              onDelete={() => setDeleteConfirm(config)}
              onSetDefault={() => handleSetDefault(config.id)}
              onTest={() => handleTest(config.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <ConfigProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        title={editingConfig ? 'Edit Langfuse Configuration' : 'Add Langfuse Configuration'}
        fields={LANGFUSE_FIELDS}
        initialData={
          editingConfig
            ? {
                name: editingConfig.name,
                host: editingConfig.host,
                publicKey: editingConfig.publicKey,
                secretKey: editingConfig.hasSecretKey ? '********' : '',
                isDefault: editingConfig.isDefault,
              }
            : undefined
        }
        isEditing={!!editingConfig}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Configuration?"
        variant="danger"
        confirmText="Delete"
        cancelText="Cancel"
        message={
          <div>
            <p>
              Are you sure you want to delete the configuration{' '}
              <strong>"{deleteConfirm?.name}"</strong>?
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This action cannot be undone.
            </p>
          </div>
        }
      />
    </div>
  );
}
