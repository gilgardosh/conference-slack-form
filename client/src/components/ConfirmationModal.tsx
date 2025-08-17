import { useEffect, useState } from 'react';
import type { FormData } from '../types';
import { sanitizePreview } from '../lib/api';

interface ConfirmationModalProps {
  isOpen: boolean;
  formData: FormData;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
  success?: boolean;
}

export function ConfirmationModal({ 
  isOpen, 
  formData, 
  onConfirm, 
  onCancel, 
  isLoading,
  error,
  success
}: ConfirmationModalProps) {
  const [sanitizedName, setSanitizedName] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen && formData.companyName) {
      setPreviewLoading(true);
      sanitizePreview(formData.companyName)
        .then(response => {
          if (response.ok && response.data?.sanitizedCompanyName) {
            setSanitizedName(response.data.sanitizedCompanyName);
          } else {
            setSanitizedName(response.error || 'Error loading preview');
          }
        })
        .catch(() => {
          setSanitizedName('Error loading preview');
        })
        .finally(() => {
          setPreviewLoading(false);
        });
    }
  }, [isOpen, formData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Confirm Submission
        </h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name (Raw):
            </label>
            <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
              {formData.companyName}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sanitized Channel Name:
            </label>
            <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
              {previewLoading ? 'Loading...' : sanitizedName}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email:
            </label>
            <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
              {formData.email}
            </p>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-600 dark:text-green-400">
              ✅ Successfully submitted! Check your email for further instructions.
            </p>
          </div>
        )}
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {success ? 'Close' : 'Cancel'}
          </button>
          {!success && (
            <button
              onClick={onConfirm}
              disabled={isLoading || previewLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {isLoading ? 'Submitting...' : 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
