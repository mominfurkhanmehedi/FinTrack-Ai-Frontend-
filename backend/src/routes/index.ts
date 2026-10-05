import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { authRoutes } from './auth';
import { userRoutes } from './users';
import { transactionRoutes } from './transactions';
import { goalRoutes } from './goals';
import { categoryRoutes } from './categories';
import { budgetRoutes } from './budgets';
import { analyticsRoutes } from './analytics';
import { currencyRoutes } from './currency';
import { aiRoutes } from './ai';
import { notificationRoutes } from './notifications';

export const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/users', authMiddleware, userRoutes);
apiRoutes.use('/transactions', authMiddleware, transactionRoutes);
apiRoutes.use('/goals', authMiddleware, goalRoutes);
apiRoutes.use('/categories', authMiddleware, categoryRoutes);
apiRoutes.use('/budgets', authMiddleware, budgetRoutes);
apiRoutes.use('/analytics', authMiddleware, analyticsRoutes);
apiRoutes.use('/currency', currencyRoutes);
apiRoutes.use('/ai', authMiddleware, aiRoutes);
apiRoutes.use('/notifications', authMiddleware, notificationRoutes);
