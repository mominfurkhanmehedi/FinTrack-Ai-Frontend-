import { Bell, ChevronDown, Search } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="flex items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search transactions..."
            className="w-full rounded-full border-0 bg-gray-100 py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          <div className="hidden h-8 w-px bg-gray-200 sm:block" />

          <button
            type="button"
            className="flex items-center gap-2.5 rounded-full p-1 pr-2 transition hover:bg-gray-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-sm font-semibold text-white">
              FP
            </div>
            <span className="hidden text-sm font-semibold text-gray-800 sm:block">Faiz</span>
            <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}