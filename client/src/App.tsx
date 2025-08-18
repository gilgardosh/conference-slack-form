import { useState } from 'react';
import { Form } from './components/Form';
import { ConfirmationModal } from './components/ConfirmationModal';
import { DarkModeToggle } from './components/DarkModeToggle';
import type { FormData } from './types';
import { submitSubmission } from './lib/api';

function App() {
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    email: '',
  });
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
      const response = await submitSubmission({
        companyName: formData.companyName,
        email: formData.email,
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setShouldResetForm(true);
        // Clear form and close modal after showing success
        setTimeout(() => {
          setShowModal(false);
          setSubmitSuccess(false);
        }, 2000);
      } else {
        // Handle specific error cases
        if (response.rateLimitInfo) {
          // Rate limit error (429)
          const { type, remaining } = response.rateLimitInfo;
          setSubmitError(
            `${response.error} (${type} rate limit, ${remaining} remaining)`
          );
        } else if (
          response.error === "Submission failed — we're looking into it"
        ) {
          // Slack error (502) - log to console for debugging
          console.error('Slack integration error:', response.error);
          setSubmitError(response.error);
        } else {
          // Other errors
          setSubmitError(
            response.error || 'Submission failed. Please try again.'
          );
        }
      }
    } catch {
      setSubmitError(
        'Network error. Please check your connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setSubmitError('');
    setSubmitSuccess(false);
  };

  const handleFormReset = () => {
    setShouldResetForm(false);
  };

  return (
    <div className='min-h-screen bg-white dark:bg-gray-900 transition-colors'>
      <div className='container mx-auto px-4 py-8'>
        <div className='flex justify-between items-start mb-8'>
          
          <div className='flex justify-center'>
            <img
              src='/full-dark-logo.svg'
              alt='Company Logo'
              className='h-20 block dark:hidden'
            />
            <img
              src='/full-white-logo.svg'
              alt='Company Logo'
              className='h-20 hidden dark:block'
            />
          </div>
          <DarkModeToggle />
        </div>

        <div className='max-w-md mx-auto'>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg p-6'>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-4'>
              Let&apos;s Continue on Slack
            </h1>
            
            <p className='text-gray-600 dark:text-gray-300 mb-6'>
              Join our Slack workspace. We&apos;ll create a dedicated
              channel for your company.
            </p>

            <Form
              onSubmit={handleFormSubmit}
              isSubmitting={isSubmitting}
              onReset={handleFormReset}
              shouldReset={shouldResetForm}
            />

            {submitError && (
              <div className='mt-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md'>
                <p className='text-sm text-red-600 dark:text-red-400'>
                  {submitError}
                </p>
              </div>
            )}

            {submitSuccess && (
              <div className='mt-4 p-3 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-md'>
                <p className='text-sm text-green-600 dark:text-green-400'>
                  ✅ Successfully submitted! Check your email for further
                  instructions.
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
        error={submitError}
        success={submitSuccess}
      />
    </div>
  );
}

export default App;
