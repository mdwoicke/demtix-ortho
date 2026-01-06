/**
 * ConfigProfileModal Component
 * Modal for adding/editing configuration profiles
 */

import { useState, useEffect } from 'react';
import { Spinner } from '../../ui';
import { cn } from '../../../utils/cn';

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'password';
  required?: boolean;
  placeholder?: string;
}

interface ConfigProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, string | boolean>) => Promise<void>;
  title: string;
  fields: ConfigField[];
  initialData?: Record<string, string | boolean>;
  isEditing?: boolean;
}

export function ConfigProfileModal({
  isOpen,
  onClose,
  onSave,
  title,
  fields,
  initialData,
  isEditing = false,
}: ConfigProfileModalProps) {
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || { isDefault: false });
      setShowPasswords({});
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleChange = (key: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    for (const field of fields) {
      if (field.required && !formData[field.key]) {
        setError(`${field.label} is required`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                    value={(formData[field.key] as string) || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={isSaving}
                    className={cn(
                      'w-full px-3 py-2 text-sm border rounded-lg transition-colors',
                      'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
                      'placeholder-gray-400 dark:placeholder-gray-500',
                      'border-gray-300 dark:border-gray-600',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      field.type === 'password' && 'pr-10',
                      isSaving && 'opacity-50 cursor-not-allowed'
                    )}
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(field.key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPasswords[field.key] ? (
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
                  )}
                </div>
              </div>
            ))}

            {/* Set as Default Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.isDefault}
                onChange={(e) => handleChange('isDefault', e.target.checked)}
                disabled={isSaving}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Set as default configuration
              </span>
            </label>

            {/* Error */}
            {error && (
              <div className="px-3 py-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                'hover:bg-gray-200 dark:hover:bg-gray-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-2'
              )}
            >
              {isSaving ? (
                <>
                  <Spinner size="sm" />
                  Saving...
                </>
              ) : (
                isEditing ? 'Save Changes' : 'Create'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
