import { Router, type Request, type Response, type NextFunction } from 'express';
import { AuthUser } from '../middleware/auth';

declare module 'express' {
  interface Request {
    user?: AuthUser;
    userId?: string;
    params: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
    headers: {
      authorization?: string;
      [key: string]: string | string[] | undefined;
    };
    body: unknown;
  }
}

import { getSupabaseClient } from '../services/database';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiError, successResponse } from '../middleware/errorHandler';
import { currencySchema } from '../validators/schemas';
import { getExchangeRates, getSupportedCurrencies, getBaseCurrency, getCacheStatus, clearCache } from '../services/exchangeRate';

export const currencyRoutes = Router();

// Public exchange-rate endpoints (work without authentication)
currencyRoutes.get('/supported', asyncHandler(async (_req: Request, res: Response) => {
  return successResponse({
    currencies: getSupportedCurrencies(),
    base: getBaseCurrency(),
  }, res);
}));

currencyRoutes.get('/rates', asyncHandler(async (req: Request, res: Response) => {
  const base = (req.query.base as string) || getBaseCurrency();
  const forceRefresh = req.query.refresh === 'true';

  if (!getSupportedCurrencies().includes(base)) {
    throw ApiError.badRequest(`Unsupported base currency: ${base}`);
  }

  const rates = await getExchangeRates(base, forceRefresh);
  return successResponse(rates, res);
}));

currencyRoutes.get('/rates/status', asyncHandler(async (_req: Request, res: Response) => {
  return successResponse({
    cache: getCacheStatus(),
    supportedCurrencies: getSupportedCurrencies(),
    baseCurrency: getBaseCurrency(),
  }, res);
}));

currencyRoutes.post('/rates/refresh', asyncHandler(async (req: Request, res: Response) => {
  const base = (req.query.base as string) || getBaseCurrency();

  if (!getSupportedCurrencies().includes(base)) {
    throw ApiError.badRequest(`Unsupported base currency: ${base}`);
  }

  clearCache();
  const rates = await getExchangeRates(base, true);
  return successResponse(rates, res);
}));

// User-specific endpoints (require authentication)
// GET /currency/preference - Returns the authenticated user's currency preference.
// POST /currency/preference - Updates the authenticated user's currency preference.
// NOTE: This endpoint only updates the profile currency column. It does NOT convert
// stored transaction/goal/budget amounts. The frontend should use the atomic
// currency conversion flow (setCurrency in store) which calls convert_currency_data RPC.
currencyRoutes.get('/preference', asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) {
    throw ApiError.unauthorized('Authentication required');
  }
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId;

  const { data: profile } = await client
    .from('profiles')
    .select('currency')
    .eq('id', userId)
    .single();

  return successResponse({ currency: profile?.currency || getBaseCurrency() }, res);
}));

currencyRoutes.post('/preference', asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) {
    throw ApiError.unauthorized('Authentication required');
  }
  const input = currencySchema.parse(req.body);
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId;

  const { data: profile } = await client
    .from('profiles')
    .select('currency')
    .eq('id', userId)
    .single();

  const currentCurrency = profile?.currency || getBaseCurrency();

  if (input.currency === currentCurrency) {
    return successResponse({ currency: currentCurrency, converted: false }, res);
  }

  const { error } = await client
    .from('profiles')
    .upsert({ id: userId, currency: input.currency });

  if (error) {
    console.error('[currency/preference] database error:', error.message);
    throw ApiError.badRequest('Failed to update currency preference');
  }

  return successResponse({ currency: input.currency, converted: true }, res);
}));

// POST /currency/convert - Convert an amount between currencies for the authenticated user.
// Requires authentication. Validates input and uses the requested base currency for rate lookup.
currencyRoutes.post('/convert', asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) {
    throw ApiError.unauthorized('Authentication required');
  }

  const { from, to, amount } = req.body as { from: string; to: string; amount: unknown };

  if (!from || !to || amount === undefined) {
    throw ApiError.badRequest('from, to, and amount are required');
  }

  if (!getSupportedCurrencies().includes(from) || !getSupportedCurrencies().includes(to)) {
    throw ApiError.badRequest('Unsupported currency');
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw ApiError.badRequest('amount must be a non-negative finite number');
  }

  if (from === to) {
    return successResponse({ from, to, amount, converted: amount }, res);
  }

  // Fetch rates using the requested 'from' currency as base, so the conversion
  // uses the correct rate pair. The getExchangeRates cache is now keyed by base.
  const rates = await getExchangeRates(from);
  const fromRate = rates.rates[from] || (from === getBaseCurrency() ? 1 : null);
  const toRate = rates.rates[to] || (to === getBaseCurrency() ? 1 : null);

  if (!fromRate || !toRate) {
    throw ApiError.badRequest('Exchange rate not available for conversion');
  }

  const converted = (amount / fromRate) * toRate;

  return successResponse({ from, to, amount, converted: Math.round(converted * 100) / 100, rate: toRate / fromRate }, res);
}));
