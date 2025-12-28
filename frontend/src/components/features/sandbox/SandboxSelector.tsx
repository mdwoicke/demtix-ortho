/**
 * SandboxSelector Component
 * Toggle between Sandbox A and Sandbox B
 */

import { cn } from '../../../utils/cn';
import type { SelectedSandbox, Sandbox } from '../../../types/sandbox.types';

interface SandboxSelectorProps {
  selectedSandbox: SelectedSandbox;
  sandboxes: Sandbox[];
  onSelect: (sandbox: SelectedSandbox) => void;
  disabled?: boolean;
}

export function SandboxSelector({
  selectedSandbox,
  sandboxes,
  onSelect,
  disabled = false,
}: SandboxSelectorProps) {
  const sandboxA = sandboxes.find(s => s.sandboxId === 'sandbox_a');
  const sandboxB = sandboxes.find(s => s.sandboxId === 'sandbox_b');

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <button
        onClick={() => onSelect('sandbox_a')}
        disabled={disabled}
        className={cn(
          'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
          selectedSandbox === 'sandbox_a'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg font-bold">A</span>
          <span className="hidden sm:inline">{sandboxA?.name || 'Sandbox A'}</span>
        </div>
      </button>

      <button
        onClick={() => onSelect('sandbox_b')}
        disabled={disabled}
        className={cn(
          'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
          selectedSandbox === 'sandbox_b'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg font-bold">B</span>
          <span className="hidden sm:inline">{sandboxB?.name || 'Sandbox B'}</span>
        </div>
      </button>
    </div>
  );
}
