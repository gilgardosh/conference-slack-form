import type {
  FormData,
  SanitizePreviewResponse,
  SubmitResponse,
} from './types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export async function sanitizePreview(
  formData: FormData
): Promise<SanitizePreviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sanitize-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  return response.json();
}

export async function submitForm(formData: FormData): Promise<SubmitResponse> {
  const response = await fetch(`${API_BASE_URL}/api/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  return response.json();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidCompanyName(companyName: string): boolean {
  return companyName.trim().length > 0 && companyName.length <= 67;
}
