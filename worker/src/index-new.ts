import { Router } from 'itty-router';
import type { 
  Env, 
  FormSubmissionRequest, 
  FormSubmissionResponse, 
  PingResponse,
  ApiErrorResponse 
} from './types';
import { 
  generateId, 
  jsonResponse, 
  errorResponse, 
  sanitizeCompanyNamePreview 
} from './utils';

// Create router instance
const router = Router();

/**
 * CORS preflight handler
 */
router.options('*', () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
});

/**
 * Health check endpoint
 * GET /api/ping
 */
router.get('/api/ping', (): Response => {
  const response: PingResponse = {
    ok: true,
    version: '0.1.0',
  };
  
  return jsonResponse(response);
});

/**
 * Form submission endpoint (stub implementation)
 * POST /api/submit
 */
router.post('/api/submit', async (request: Request): Promise<Response> => {
  try {
    // Parse request body
    let body: unknown;
    
    try {
      body = await request.json();
    } catch (error) {
      return errorResponse(
        'INVALID_JSON',
        'Invalid JSON in request body',
        400
      );
    }

    // Basic shape validation
    if (!body || typeof body !== 'object') {
      return errorResponse(
        'INVALID_REQUEST_BODY',
        'Request body must be a JSON object',
        400
      );
    }

    const requestData = body as Record<string, unknown>;

    // Validate required fields
    if (typeof requestData.companyName !== 'string') {
      return errorResponse(
        'MISSING_COMPANY_NAME',
        'companyName is required and must be a string',
        400
      );
    }

    if (typeof requestData.email !== 'string') {
      return errorResponse(
        'MISSING_EMAIL',
        'email is required and must be a string',
        400
      );
    }

    const submissionData: FormSubmissionRequest = {
      companyName: requestData.companyName,
      email: requestData.email,
    };

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(submissionData.email)) {
      return errorResponse(
        'INVALID_EMAIL_FORMAT',
        'Invalid email format',
        400
      );
    }

    // Generate response (stub implementation)
    const sanitizedCompanyName = sanitizeCompanyNamePreview(submissionData.companyName);
    const submissionId = generateId();

    const response: FormSubmissionResponse = {
      ok: true,
      id: submissionId,
      sanitizedCompanyName,
    };

    return jsonResponse(response);

  } catch (error) {
    console.error('Unexpected error in /api/submit:', error);
    
    return errorResponse(
      'INTERNAL_ERROR',
      'Internal server error',
      500
    );
  }
});

/**
 * Catch-all for API routes that don't exist
 */
router.all('/api/*', (): Response => {
  return errorResponse(
    'NOT_FOUND',
    'API endpoint not found',
    404
  );
});

/**
 * Static file serving (placeholder for production builds)
 */
router.get('*', (request: Request): Response => {
  const url = new URL(request.url);
  
  // In production, this would serve static files from the client build
  // For now, return a simple HTML page
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conference Slack Form</title>
</head>
<body>
    <div id="root">
        <h1>Conference Slack Form</h1>
        <p>Worker is running. Client app will be served here in production.</p>
        <p>API endpoints:</p>
        <ul>
            <li><a href="/api/ping">GET /api/ping</a></li>
            <li>POST /api/submit</li>
        </ul>
    </div>
</body>
</html>
    `.trim();
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
  
  return errorResponse(
    'NOT_FOUND',
    'File not found',
    404
  );
});

/**
 * Main worker export
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return router.handle(request, env);
  },
};
