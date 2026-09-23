import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Settings,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Transactions', icon: ArrowLeftRight, active: false },
  { label: 'AI Insights', icon: Sparkles, active: false },
  { label: 'Budget & Goals', icon: Wallet, active: false },
  { label: 'Reports', icon: BarChart3, active: false },
  { label: 'Settings', icon: Settings, active: false },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-gray-200 bg-white lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-gray-900">
          FinTrack <span className="text-indigo-600">AI</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href="#"
              aria-current={item.active ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                item.active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  item.active
                    ? 'text-indigo-600'
                    : 'text-gray-400 group-hover:text-gray-600'
                }`}
              />
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Promo card */}
      <div className="px-3 pb-5">
        <div className="rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 p-4 text-white">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold leading-snug">
            Smarter decisions for a better tomorrow
          </p>
        </div>
      </div>
    </aside>
  );
}