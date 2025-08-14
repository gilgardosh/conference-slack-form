import { useState, useRef, useEffect } from 'react';
import type { FormData } from '../types';
import { isValidEmail, isValidCompanyName } from '../utils';

interface FormProps {
  onSubmit: (formData: FormData) => void;
  isSubmitting: boolean;
  onReset: () => void;
  shouldReset: boolean;
}

export function Form({ onSubmit, isSubmitting, onReset, shouldReset }: FormProps) {
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    email: '',
  });
  
  const companyNameRef = useRef<HTMLInputElement>(null);

  // Reset form when shouldReset changes to true
  useEffect(() => {
    if (shouldReset) {
      setFormData({ companyName: '', email: '' });
      companyNameRef.current?.focus();
      onReset();
    }
  }, [shouldReset, onReset]);

  // Auto-focus on mount
  useEffect(() => {
    companyNameRef.current?.focus();
  }, []);

  const isValid = isValidCompanyName(formData.companyName) && isValidEmail(formData.email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isSubmitting) {
      onSubmit(formData);
    }
  };

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 67) {
      setFormData(prev => ({ ...prev, companyName: value }));
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, email: e.target.value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label 
          htmlFor="companyName" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Company Name
        </label>
        <input
          ref={companyNameRef}
          id="companyName"
          type="text"
          value={formData.companyName}
          onChange={handleCompanyNameChange}
          maxLength={67}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your company name"
          disabled={isSubmitting}
        />
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {formData.companyName.length}/67 characters
        </div>
      </div>

      <div>
        <label 
          htmlFor="email" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={handleEmailChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your email address"
          disabled={isSubmitting}
        />
      </div>

      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500 flex items-center justify-center gap-2"
      >
        {isSubmitting && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        )}
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
