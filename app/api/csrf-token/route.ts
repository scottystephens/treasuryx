/**
 * CSRF Token Endpoint
 * 
 * GET /api/csrf-token
 * Returns a CSRF token for authenticated users
 */

import { getCsrfTokenHandler } from '@/lib/security/csrf';

export const GET = getCsrfTokenHandler;

