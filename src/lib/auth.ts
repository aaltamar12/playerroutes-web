import { NextRequest } from 'next/server';

/**
 * Verify that a request has an authentication token.
 *
 * Note: The actual token validation is done by the Minecraft mod's WebSocket.
 * This function only checks that a token is present, since the real validation
 * already happened when the user connected to the mod.
 */
export function verifyAuth(request: NextRequest): boolean {
  // Check query parameter first
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken && queryToken.length > 0) {
    return true;
  }

  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return false;
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token.length > 0;
  }

  return authHeader.length > 0;
}

/**
 * Extract the token from a request (for passing to other services)
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}
