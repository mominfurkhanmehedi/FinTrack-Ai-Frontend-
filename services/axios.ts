import axios, { AxiosError, AxiosInstance } from 'axios';

/**
 * Shared Axios instance.
 * Points at a configurable base URL. When no backend is present the app falls
 * back to the mock services (services/mock), but wiring a real API only
 * requires setting EXPO_PUBLIC_API_URL and pointing services at this instance.
 */
export const api: AxiosInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Attach a bearer token to every outgoing request. */
export function setAuthToken(token: string | null): void {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/** Normalize any thrown error into a readable message. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{ message?: string }>;
    return err.response?.data?.message ?? err.message ?? 'Request failed.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
