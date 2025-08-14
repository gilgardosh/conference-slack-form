import { useState } from 'react';
import { Form } from './components/Form';
import { ConfirmationModal } from './components/ConfirmationModal';
import { DarkModeToggle } from './components/DarkModeToggle';
import type { FormData } from './types';
import { submitForm } from './utils';

function App() {
  const [formData, setFormData] = useState<FormData>({ companyName: '', email: '' });
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [shouldResetForm, setShouldResetForm] = useState(false);

  const handleFormSubmit = (data: FormData) => {
    setFormData(data);
    setShowModal(true);
    setSubmitError('');
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await submitForm(formData);
      
      if (response.ok) {
        setSubmitSuccess(true);
        setShowModal(false);
        setShouldResetForm(true);
        // Reset success state after a delay
        setTimeout(() => setSubmitSuccess(false), 3000);
      } else {
        setSubmitError(response.message || 'Submission failed. Please try again.');
      }
    } catch (error) {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setSubmitError('');
  };

  const handleFormReset = () => {
    setShouldResetForm(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Conference Slack Form
          </h1>
          <DarkModeToggle />
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Join our conference Slack workspace. We'll create a dedicated channel for your company.
            </p>

            <Form
              onSubmit={handleFormSubmit}
              isSubmitting={isSubmitting}
              onReset={handleFormReset}
              shouldReset={shouldResetForm}
            />

            {submitError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
              </div>
            )}

            {submitSuccess && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✅ Successfully submitted! Check your email for further instructions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showModal}
        formData={formData}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isLoading={isSubmitting}
      />
    </div>
  );
}

export default App;
