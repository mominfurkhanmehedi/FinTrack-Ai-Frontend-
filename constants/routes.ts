/**
 * Centralized route paths so navigation never relies on magic strings.
 * Root of the tree is `app/`; groups `(auth)`, `(tabs)`, `(modals)` are
 * transparent segments that do not appear in the URL.
 */
export const ROUTES = {
  LANDING: '/landing',
  LOGIN: '/login',
  SIGNUP: '/signup',
  VERIFY_OTP: '/verify-otp',
  FORGOT_PASSWORD: '/forgot-password',

  DASHBOARD: '/dashboard',
  TRANSACTIONS: '/transactions',
  INSIGHTS: '/insights',
  BUDGET: '/budget',
  REPORTS: '/reports',
  SETTINGS: '/settings',

  MODALS: {
    ADD_TRANSACTION: '/add-transaction',
    EDIT_TRANSACTION: '/edit-transaction',
    ADD_GOAL: '/add-goal',
    ADD_SAVING: '/add-saving',
    TRANSACTION_DETAIL: '/transaction-detail',
  },

  SETTINGS_SCREENS: {
    EDIT_PROFILE: '/edit-profile',
    CHANGE_PASSWORD: '/change-password',
    DELETE_ACCOUNT: '/delete-account',
    NOTIFICATIONS: '/notifications',
    THEME: '/theme-picker',
    CURRENCY: '/currency-picker',
    LANGUAGE: '/language-picker',
    EXPORT_DATA: '/export-data',
    HELP_SUPPORT: '/help-support',
    FAQS: '/faqs',
    CONTACT_US: '/contact-us',
    ABOUT: '/about',
    PRIVACY_POLICY: '/privacy-policy',
    TERMS: '/terms',
  },
} as const;