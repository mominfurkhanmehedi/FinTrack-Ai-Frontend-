import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';

const ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Transactions', icon: ArrowLeftRight, active: false },
  { label: 'Insights', icon: Sparkles, active: false },
  { label: 'Budget', icon: Wallet, active: false },
  { label: 'Reports', icon: BarChart3, active: false },
  { label: 'Settings', icon: Settings, active: false },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex items-stretch">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href="#"
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                item.active ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}