# FinTrack AI Backend

Node.js + Express.js backend API for FinTrack AI financial tracking application.

## Features

- **Authentication**: Supabase Auth integration with JWT verification
- **Transactions**: Full CRUD with filtering, pagination, and summaries
- **Goals**: Savings goals with progress tracking and contributions
- **Categories**: Custom income/expense categories
- **Budgets**: Budget tracking with spending alerts
- **Analytics**: Spending trends, cash flow, net worth, category breakdowns
- **Currency**: Exchange rates with caching (Frankfurter + fallbacks), currency conversion
- **AI Assistant**: Financial Q&A with local fallback analyzer
- **Notifications**: In-app notification system
- **Security**: Helmet, CORS, Rate limiting, JWT validation

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (for admin operations) |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `FRONTEND_URL` | No | Frontend URL for CORS (default: http://localhost:8081) |
| `PORT` | No | Server port (default: 3000) |
| `AI_API_URL` | No | External AI provider endpoint |
| `AI_API_KEY` | No | External AI provider API key |

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-otp` - Verify email OTP
- `POST /api/auth/resend-otp` - Resend OTP
- `POST /api/auth/reset-password` - Request password reset
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update profile
- `GET /api/users/preferences` - Get preferences
- `PATCH /api/users/preferences` - Update preferences
- `PATCH /api/users/notifications` - Update notification preferences
- `DELETE /api/users/account` - Delete account

### Transactions
- `GET /api/transactions` - List transactions (with filters)
- `GET /api/transactions/:id` - Get transaction
- `POST /api/transactions` - Create transaction
- `PATCH /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `GET /api/transactions/categories/list` - Get unique categories
- `GET /api/transactions/summary` - Get summary stats

### Goals
- `GET /api/goals` - List goals
- `GET /api/goals/:id` - Get goal
- `POST /api/goals` - Create goal
- `PATCH /api/goals/:id` - Update goal
- `POST /api/goals/:id/contribute` - Add savings to goal
- `DELETE /api/goals/:id` - Delete goal

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `POST /api/categories/seed` - Seed default categories

### Budgets
- `GET /api/budgets` - List budgets
- `GET /api/budgets/:id` - Get budget
- `POST /api/budgets` - Create budget
- `PATCH /api/budgets/:id` - Update budget
- `GET /api/budgets/:id/status` - Get budget status
- `DELETE /api/budgets/:id` - Delete budget
- `GET /api/budgets/overview` - Get all budgets overview

### Analytics
- `GET /api/analytics/overview` - Financial overview
- `GET /api/analytics/spending/trends` - Monthly spending trends
- `GET /api/analytics/spending/by-category` - Category breakdown
- `GET /api/analytics/income/by-category` - Income breakdown
- `GET /api/analytics/cashflow` - Daily cash flow
- `GET /api/analytics/goals/progress` - Goals progress
- `GET /api/analytics/net-worth` - Net worth over time

### Currency
- `GET /api/currency/supported` - Supported currencies
- `GET /api/currency/rates` - Exchange rates (with caching)
- `GET /api/currency/rates/status` - Cache status
- `POST /api/currency/rates/refresh` - Force refresh rates
- `GET /api/currency/preference` - Get user currency preference
- `POST /api/currency/preference` - Set user currency preference
- `POST /api/currency/convert` - Convert amount between currencies

### AI Assistant
- `POST /api/ai/ask` - Ask financial question
- `GET /api/ai/status` - AI configuration status

### Notifications
- `GET /api/notifications` - List notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `POST /api/notifications` - Create notification (internal)

## Database Setup

Run the schema in `database/schema.sql` in your Supabase SQL Editor, or use Supabase CLI:

```bash
supabase db push
```

## Exchange Rate Architecture

The backend provides a `/api/currency/rates` endpoint that:
1. Checks memory cache first (6-hour TTL)
2. Falls back to persistent cache if available
3. Calls Frankfurter (server-side, no CORS issues)
4. Falls back to ExchangeRate-API, open.er-api.com, fawazahmed0 CDN
4. Caches successful responses
5. Returns stale cache on total failure

This removes the browser from the rate path entirely.

## AI Assistant

The `/api/ai/ask` endpoint:
1. Builds context from user's real financial data
2. Calls external AI provider if configured (`AI_API_URL`, `AI_API_KEY`)
3. Falls back to local rules-based analyzer (never invents numbers)
4. Returns source (`provider` or `local`) for transparency

## Development

```bash
npm run dev      # Start with hot reload
npm run build    # TypeScript compilation
npm run start    # Run compiled JS
npm run typecheck # Type checking
npm run lint     # ESLint
```

## Production Deployment

1. Build: `npm run build`
2. Set `NODE_ENV=production`
3. Use process manager (PM2, Docker, etc.)
4. Ensure all environment variables are set
5. Run migrations: `supabase db push`

## License

MIT