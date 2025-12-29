/**
 * Reference Documents Component
 * Collapsible section for uploading and managing reference documents per file type
 */

import React, { useState, useRef, useCallback, DragEvent } from 'react';
import type { ReferenceDocument } from '../../../types/aiPrompting.types';
import {
  SUPPORTED_REFERENCE_EXTENSIONS,
  MAX_REFERENCE_FILE_SIZE,
} from '../../../types/aiPrompting.types';

// ============================================================================
// FILE TYPE ICONS
// ============================================================================

const FileTypeIcon: React.FC<{ mimeType: string; className?: string }> = ({
  mimeType,
  className = 'w-4 h-4',
}) => {
  if (mimeType.includes('pdf')) {
    return (
      <svg className={`${className} text-red-500`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (mimeType.includes('word') || mimeType.includes('docx')) {
    return (
      <svg className={`${className} text-blue-500`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (mimeType.includes('sheet') || mimeType.includes('xlsx')) {
    return (
      <svg className={`${className} text-green-500`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2 2V4z" clipRule="evenodd" />
      </svg>
    );
  }
  // Default text/markdown icon
  return (
    <svg className={`${className} text-gray-500`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  );
};

// ============================================================================
// REFERENCE DOCUMENT ITEM
// ============================================================================

interface ReferenceDocumentItemProps {
  document: ReferenceDocument;
  onDelete: (documentId: string) => Promise<void>;
  onToggleEnabled: (documentId: string, isEnabled: boolean) => Promise<void>;
  onUpdateLabel: (documentId: string, label: string) => Promise<void>;
  isDeleting: boolean;
}

const ReferenceDocumentItem: React.FC<ReferenceDocumentItemProps> = ({
  document,
  onDelete,
  onToggleEnabled,
  onUpdateLabel,
  isDeleting,
}) => {
  const [isToggling, setIsToggling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(document.label);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggleEnabled(document.documentId, !document.isEnabled);
    } finally {
      setIsToggling(false);
    }
  };

  const handleLabelBlur = async () => {
    setIsEditing(false);
    if (label !== document.label && label.trim()) {
      setIsSaving(true);
      try {
        await onUpdateLabel(document.documentId, label.trim());
      } finally {
        setIsSaving(false);
      }
    } else {
      setLabel(document.label); // Reset if empty
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setLabel(document.label);
      setIsEditing(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg text-xs group transition-colors ${
      document.isEnabled
        ? 'bg-gray-50 dark:bg-gray-700/50'
        : 'bg-gray-100/50 dark:bg-gray-800/30 opacity-60'
    }`}>
      {/* Checkbox for enabling/disabling */}
      <input
        type="checkbox"
        checked={document.isEnabled}
        onChange={handleToggle}
        disabled={isToggling || document.extractionStatus !== 'success'}
        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
        title={document.isEnabled ? 'Included in enhancements' : 'Not included in enhancements'}
      />

      <FileTypeIcon mimeType={document.mimeType} />

      {/* Editable label */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={handleKeyDown}
            className="w-full px-1 py-0.5 text-xs border border-blue-500 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className={`text-left truncate w-full hover:text-blue-600 dark:hover:text-blue-400 ${
              document.isEnabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'
            }`}
            title={`${label} - Click to rename`}
          >
            {isSaving ? 'Saving...' : label}
          </button>
        )}
      </div>

      {/* Status indicator - only show if failed */}
      {document.extractionStatus === 'failed' && (
        <span
          className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          title={document.extractionError || 'Extraction failed'}
        >
          Failed
        </span>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(document.documentId)}
        disabled={isDeleting}
        className="shrink-0 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        title="Delete document"
      >
        {isDeleting ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
    </div>
  );
};

// ============================================================================
// UPLOAD DROPZONE
// ============================================================================

interface UploadDropzoneProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({ onUpload, isUploading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        await onUpload(file);
      }
    },
    [onUpload]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isUploading && fileInputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors
        ${isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }
        ${isUploading ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_REFERENCE_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />
      {isUploading ? (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Uploading...</span>
        </div>
      ) : (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-5 h-5 mx-auto mb-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>Drop file or click to upload</span>
          <div className="mt-1 text-gray-400 dark:text-gray-500">
            .txt, .md, .pdf, .docx, .xlsx (max {MAX_REFERENCE_FILE_SIZE / 1024 / 1024}MB)
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface ReferenceDocumentsProps {
  fileKey: string;
  documents: ReferenceDocument[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onToggleEnabled: (documentId: string, isEnabled: boolean) => Promise<void>;
  onUpdateLabel: (documentId: string, label: string) => Promise<void>;
  loading?: boolean;
  uploadError?: string;
}

const ReferenceDocuments: React.FC<ReferenceDocumentsProps> = ({
  fileKey,
  documents,
  onUpload,
  onDelete,
  onToggleEnabled,
  onUpdateLabel,
  loading = false,
  uploadError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    // Validate file size
    if (file.size > MAX_REFERENCE_FILE_SIZE) {
      setLocalError(`File too large. Maximum size is ${MAX_REFERENCE_FILE_SIZE / 1024 / 1024}MB.`);
      return;
    }

    // Validate file type
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!SUPPORTED_REFERENCE_EXTENSIONS.includes(ext)) {
      setLocalError(`Unsupported file type. Supported: ${SUPPORTED_REFERENCE_EXTENSIONS.join(', ')}`);
      return;
    }

    setLocalError(null);
    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (error: any) {
      setLocalError(error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId);
    try {
      await onDelete(documentId);
    } finally {
      setDeletingId(null);
    }
  };

  const displayError = localError || uploadError;

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
      className="mt-1"
    >
      <summary
        className={`
          flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer
          text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200
          hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors
        `}
      >
        <div className="flex items-center gap-1.5">
          <svg
            className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Reference Docs</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
          documents.length > 0
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          {loading ? '...' : documents.length}
        </span>
      </summary>

      <div className="mt-2 space-y-2 pl-2">
        {/* Upload dropzone */}
        <UploadDropzone onUpload={handleUpload} isUploading={isUploading} />

        {/* Error message */}
        {displayError && (
          <div className="p-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
            {displayError}
          </div>
        )}

        {/* Document list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : documents.length > 0 ? (
          <div className="space-y-1">
            {documents.map((doc) => (
              <ReferenceDocumentItem
                key={doc.documentId}
                document={doc}
                onDelete={handleDelete}
                onToggleEnabled={onToggleEnabled}
                onUpdateLabel={onUpdateLabel}
                isDeleting={deletingId === doc.documentId}
              />
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
            No reference documents yet
          </div>
        )}
      </div>
    </details>
  );
};

export default ReferenceDocuments;
