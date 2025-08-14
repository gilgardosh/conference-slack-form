import { z } from 'zod';

// Zod schema for input validation
const FormSubmissionSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  email: z.string().email('Invalid email format'),
});

export type FormSubmissionInput = z.infer<typeof FormSubmissionSchema>;

export interface ValidationResult {
  ok: true;
  value: {
    companyName: string;
    email: string;
    sanitizedCompanyName: string;
  };
}

export interface ValidationError {
  ok: false;
  errors: string[];
}

/**
 * Sanitize company name according to Slack channel naming rules
 */
export function sanitizeCompanyName(raw: string): string {
  return raw
    // Convert to lowercase
    .toLowerCase()
    // Normalize accents to ASCII and strip combining marks
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace sequences of whitespace with single dashes
    .replace(/\s+/g, '-')
    // Remove any non-latin letters, numbers, and dashes (strip emojis and symbols)
    .replace(/[^a-z0-9-]/g, '')
    // Collapse multiple dashes
    .replace(/-+/g, '-')
    // Trim leading/trailing dashes
    .replace(/^-+|-+$/g, '')
    // Truncate to 67 characters
    .slice(0, 67);
}

/**
 * Check if email domain is a free email provider
 */
export function isFreeEmailDomain(email: string): boolean {
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  
  const domain = parts[1];
  
  const freeProviders = [
    'gmail.com',
    'yahoo.com', 
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'live.com',
    'msn.com',
    'ymail.com',
    'protonmail.com',
    'mail.com',
    'zoho.com'
  ];
  
  return freeProviders.includes(domain.toLowerCase());
}

/**
 * Validate and sanitize form submission input
 */
export function validateAndSanitize(input: unknown): ValidationResult | ValidationError {
  try {
    // Validate input shape with Zod
    const validatedInput = FormSubmissionSchema.parse(input);
    
    // Sanitize company name
    const sanitizedCompanyName = sanitizeCompanyName(validatedInput.companyName);
    
    // Check if sanitized company name is empty after processing
    if (!sanitizedCompanyName) {
      return {
        ok: false,
        errors: ['Company name contains no valid characters after sanitization']
      };
    }
    
    return {
      ok: true,
      value: {
        companyName: validatedInput.companyName,
        email: validatedInput.email,
        sanitizedCompanyName
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => 
        err.path.length > 0 ? `${err.path.join('.')}: ${err.message}` : err.message
      );
      return {
        ok: false,
        errors
      };
    }
    
    return {
      ok: false,
      errors: ['Validation failed with unknown error']
    };
  }
}
