import BottomNav from './components/BottomNav.jsx';
import QuickActions from './components/QuickActions.jsx';
import Sidebar from './components/Sidebar.jsx';
import SpendingChart from './components/SpendingChart.jsx';
import StatCards from './components/StatCards.jsx';
import TopBar from './components/TopBar.jsx';

export default function App() {
  return (
    <div className="min-h-screen font-sans">
      <Sidebar />

      <div className="lg:pl-60">
        <TopBar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12">
          {/* Greeting */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Good morning, Faiz!
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-500">
              Here's your financial overview for this week.
            </p>
          </div>

          {/* Stats row */}
          <StatCards />

          {/* Second row */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <QuickActions />
            </div>
            <div className="lg:col-span-3">
              <SpendingChart />
            </div>
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}