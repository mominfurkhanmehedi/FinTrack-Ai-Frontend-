import { Minus, Plus, Target } from 'lucide-react';

const ACTIONS = [
  { label: 'Add income', icon: Plus, className: 'bg-emerald-500 text-white', hover: 'hover:bg-emerald-600' },
  { label: 'Add expense', icon: Minus, className: 'bg-rose-500 text-white', hover: 'hover:bg-rose-600' },
  { label: 'Add goal', icon: Target, className: 'bg-indigo-500 text-white', hover: 'hover:bg-indigo-600' },
];

export default function QuickActions() {
  return (
    <div className="flex flex-col justify-center rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Quick actions</h2>
      <div className="flex items-start gap-6">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              className="group flex flex-col items-center gap-3"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition ${action.className} ${action.hover}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}