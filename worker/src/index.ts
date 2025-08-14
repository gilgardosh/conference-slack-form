import type { Env } from './types';

/*    );
  },
};* Cloudflare Worker exported handler interface
 */
interface ExportedHandler<Env = unknown> {
  fetch(request: Request, env: Env): Response | Promise<Response>;
}

/**
 * Main Cloudflare Worker entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS for development
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, url);
    }

    // Serve static files (client app will be built and served here)
    return new Response('Static file serving not implemented yet', {
      status: 501,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handle API requests
 */
async function handleApiRequest(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    switch (url.pathname) {
      case '/api/ping':
        return new Response(
          JSON.stringify({ ok: true, version: '0.1.0' }),
          { headers: corsHeaders }
        );

      case '/api/submit':
        if (request.method !== 'POST') {
          return new Response(
            JSON.stringify({
              ok: false,
              errorCode: 'METHOD_NOT_ALLOWED',
              message: 'Method not allowed',
            }),
            { status: 405, headers: corsHeaders }
          );
        }

        try {
          await request.json();
        } catch {
          return new Response(
            JSON.stringify({
              ok: false,
              errorCode: 'INVALID_JSON',
              message: 'Invalid JSON in request body',
            }),
            { status: 400, headers: corsHeaders }
          );
        }

        // TODO: Implement form submission logic
        return new Response(
          JSON.stringify({
            ok: false,
            errorCode: 'NOT_IMPLEMENTED',
            message: 'Form submission not implemented yet',
          }),
          { status: 501, headers: corsHeaders }
        );

      default:
        return new Response(
          JSON.stringify({
            ok: false,
            errorCode: 'NOT_FOUND',
            message: 'API endpoint not found',
          }),
          { status: 404, headers: corsHeaders }
        );
    }
  } catch (error) {
    console.error('API request error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        message: 'Internal server error',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
