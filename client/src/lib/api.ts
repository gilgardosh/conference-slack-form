const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface SanitizePreviewData {
  sanitizedCompanyName: string;
}

export interface SubmitData {
  id: string;
  sanitizedCompanyName: string;
  slackChannelId: string;
  emailSent: boolean;
}

export interface RateLimitMetadata {
  type: 'email' | 'ip';
  remaining: number;
}

/**
 * Calls the sanitize preview endpoint to get a preview of the sanitized company name
 */
export async function sanitizePreview(companyName: string): Promise<ApiResponse<SanitizePreviewData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sanitize-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyName }),
    });

    const result = await response.json();

    if (response.ok && result.ok) {
      return {
        ok: true,
        data: {
          sanitizedCompanyName: result.sanitizedCompanyName,
        },
      };
    } else {
      return {
        ok: false,
        error: result.message || 'Failed to sanitize company name',
      };
    }
  } catch {
    return {
      ok: false,
      error: 'Network error. Please check your connection and try again.',
    };
  }
}

/**
 * Submits the form data to create a Slack channel and send an email
 */
export async function submitSubmission({
  companyName,
  email,
}: {
  companyName: string;
  email: string;
}): Promise<ApiResponse<SubmitData> & { rateLimitInfo?: RateLimitMetadata | undefined }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyName, email }),
    });

    const result = await response.json();

    if (response.status === 429) {
      // Rate limit error
      const rateLimitInfo = result.metadata ? {
        type: result.metadata.type as 'email' | 'ip',
        remaining: result.metadata.remaining,
      } : undefined;
      
      return {
        ok: false,
        error: result.message || 'Rate limit exceeded',
        rateLimitInfo,
      };
    }

    if (response.status === 502) {
      // Slack error
      return {
        ok: false,
        error: 'Submission failed — we\'re looking into it',
      };
    }

    if (response.ok && result.ok) {
      return {
        ok: true,
        data: {
          id: result.id,
          sanitizedCompanyName: result.sanitizedCompanyName,
          slackChannelId: result.slackChannelId,
          emailSent: result.emailSent,
        },
      };
    } else {
      return {
        ok: false,
        error: result.message || 'Submission failed. Please try again.',
      };
    }
  } catch {
    return {
      ok: false,
      error: 'Network error. Please check your connection and try again.',
    };
  }
}
