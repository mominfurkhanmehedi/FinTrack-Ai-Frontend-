# FinTrack AI

A cross-platform finance tracking app built with **React Native + Expo Router** (TypeScript), running on **iOS, Android, and Web** from a single codebase via **react-native-web**.

## Stack

- **Expo SDK 57** / React Native 0.86
- **Expo Router** (file-based routing) — one navigation tree for all platforms
- **NativeWind v4** (Tailwind CSS) — responsive styling shared across web and mobile
- **Zustand** — global state (auth, transactions, goals) with AsyncStorage persistence
- **Axios** — API layer in `services/`, ready for REST / Supabase / Firebase
- **react-native-chart-kit** + react-native-svg — charts that work on web too
- **TypeScript** throughout

## Quick start

```bash
npm install
npm run web      # or: npm start  /  npm run ios  /  npm run android
```

## Folder structure

Grouped by **feature area**, with shared UI primitives in `components/ui` and per-feature building blocks under `components/<feature>`.

```
FinTrackAI/
├── app/                     # Expo Router routes (file-based)
│   ├── _layout.tsx          # Root: imports global.css, guards auth routing
│   ├── index.tsx            # Redirects / → Dashboard or Landing
│   ├── (auth)/              # Pre-login flow
│   │   ├── _layout.tsx
│   │   ├── landing.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/              # Primary app shell (5 main tabs)
│   │   ├── _layout.tsx      # ONE layout: bottom bar (mobile) / sidebar (web)
│   │   ├── dashboard.tsx
│   │   ├── transactions.tsx
│   │   ├── insights.tsx
│   │   ├── budget.tsx
│   │   └── settings.tsx
│   └── (modals)/            # Add/edit/detail screens, reused across tabs
│       ├── _layout.tsx
│       ├── add-transaction.tsx
│       ├── edit-transaction.tsx
│       ├── transaction-detail.tsx
│       └── add-goal.tsx
├── components/
│   ├── layout/              # Sidebar (web/tablet)
│   ├── ui/                  # Primitives: Button, Card, Input, Chart, Grid,
│   │                        #   ResponsiveContainer, ScreenHeader
│   ├── dashboard/           # BalanceCard, NetChange, RecentActivity, QuickActions
│   └── transactions/        # TransactionListItem, TransactionForm
├── hooks/                   # useBreakpoint (single responsive source of truth)
├── store/                   # Zustand store (auth, transactions, goals)
├── services/                # Axios instance + mock authService
├── constants/               # breakpoints, routes, theme
├── types/                   # Shared TypeScript types
└── utils/                   # Pure helpers (currency, dates, ids)
```

## Responsiveness

- **Navigation** — ONE `<Tabs>` navigator in `app/(tabs)/_layout.tsx`. It swaps only the rendered `tabBar` via the `useBreakpoint` hook: a **bottom tab bar** on mobile, a **left sidebar** on web/tablet. No second navigation system.
- **Breakpoints** — `hooks/useBreakpoint.ts` derives a `mobile | tablet | desktop | wide` mode from `useWindowDimensions()` (`constants/breakpoints.ts`).
- **Grids** — Dashboard uses `components/ui/Grid.tsx`, collapsing from **3–4 columns (web)** to **1 column (mobile)** based on the breakpoint.

## Screens

| Screen             | Route                        | Group     | Purpose                                              |
| ------------------ | ---------------------------- | --------- | ---------------------------------------------------- |
| Landing            | `(auth)/landing`             | (auth)    | Signed-out hero + auth CTAs                          |
| Login / Signup     | `(auth)/login`, `/signup`    | (auth)    | Auth via mock `authService`                          |
| Forgot Password    | `(auth)/forgot-password`     | (auth)    | Request password-reset link                          |
| Dashboard          | `(tabs)/dashboard`           | (tabs)    | Balance, income vs. expenses chart, quick actions    |
| Transactions       | `(tabs)/transactions`        | (tabs)    | Searchable, filterable transaction list              |
| AI Insights        | `(tabs)/insights`            | (tabs)    | Spending predictions, budget suggestions, breakdown  |
| Budget & Goals     | `(tabs)/budget`              | (tabs)    | Savings-goal progress bars                           |
| Settings           | `(tabs)/settings`            | (tabs)    | Profile, data utilities, sign out                    |
| Add / Edit Tx      | `(modals)/add-transaction` … | (modals)  | Create / edit a transaction                          |
| Transaction Detail | `(modals)/transaction-detail`| (modals)  | Detail view with edit/delete                         |
| Add Goal           | `(modals)/add-goal`          | (modals)  | Create a savings goal                                |

## Status

Working end-to-end flow on iOS, Android, and Web. All screens render live
Zustand data (transactions, goals, computed totals), the Dashboard includes a
real income-vs-expenses chart, and the layout switches between bottom tabs
(mobile) and a sidebar (web/tablet) automatically.

Data is seeded and persisted to AsyncStorage. A real backend can replace
`services/` — the Axios instance in `services/axios.ts` is ready, and only
needs `EXPO_PUBLIC_API_URL` set to point at a live REST / Supabase / Firebase
endpoint.