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

currencyRoutes.get('/preference', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data: profile } = await client
    .from('profiles')
    .select('currency')
    .eq('id', userId)
    .single();

  return successResponse({ currency: profile?.currency || getBaseCurrency() }, res);
}));

currencyRoutes.post('/preference', asyncHandler(async (req: Request, res: Response) => {
  const input = currencySchema.parse(req.body);
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

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

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ currency: input.currency, converted: true }, res);
}));

currencyRoutes.post('/convert', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { from, to, amount } = req.body as { from: string; to: string; amount: number };

  if (!from || !to || amount === undefined) {
    throw ApiError.badRequest('from, to, and amount are required');
  }

  if (!getSupportedCurrencies().includes(from) || !getSupportedCurrencies().includes(to)) {
    throw ApiError.badRequest('Unsupported currency');
  }

  if (from === to) {
    return successResponse({ from, to, amount, converted: amount }, res);
  }

  const rates = await getExchangeRates('INR');
  const fromRate = rates.rates[from] || (from === 'INR' ? 1 : null);
  const toRate = rates.rates[to] || (to === 'INR' ? 1 : null);

  if (!fromRate || !toRate) {
    throw ApiError.badRequest('Exchange rate not available for conversion');
  }

  const converted = (amount / fromRate) * toRate;

  return successResponse({ from, to, amount, converted: Math.round(converted * 100) / 100, rate: toRate / fromRate }, res);
}));
