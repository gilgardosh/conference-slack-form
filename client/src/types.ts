export interface FormData {
  companyName: string;
  email: string;
}

export interface SanitizePreviewResponse {
  ok: boolean;
  sanitizedCompanyName?: string;
  code?: string;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface SubmitResponse {
  ok: boolean;
  id?: string;
  sanitizedCompanyName?: string;
  slackChannelId?: string;
  emailSent?: boolean;
  errorCode?: string;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
  metadata?: {
    type: string;
    remaining: number;
  };
}
