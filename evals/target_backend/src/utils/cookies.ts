import { Response } from 'express';

// Helper function to set secure cookies
export function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  options: any
) {
  res.cookie(name, value, {
    ...options,
    httpOnly: options.httpOnly || false,
    secure: options.secure || process.env.NODE_ENV === 'production',
    sameSite: options.sameSite || 'strict',
  });
}

// Helper function to clear cookies
export function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}
