import { ArrowDownLeft, ArrowUpRight, CreditCard, TrendingUp } from 'lucide-react';

const VARIANTS = {
  balance: {
    bg: 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white',
    label: 'text-indigo-100',
    amount: 'text-white',
    trend: 'text-indigo-100',
    trendIcon: TrendingUp,
  },
  income: {
    bg: 'bg-emerald-50',
    label: 'text-gray-500',
    amount: 'text-emerald-600',
    trend: 'text-gray-400',
  },
  expenses: {
    bg: 'bg-rose-50',
    label: 'text-gray-500',
    amount: 'text-rose-600',
    trend: 'text-gray-400',
  },
};

function IconBadge({ variant }) {
  if (variant === 'balance') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
        <CreditCard className="h-5 w-5 text-white" />
      </div>
    );
  }
  const isIncome = variant === 'income';
  return (
    <div
      className={`flex h-9 w-9 items-center justify-center rounded-full ${
        isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
      }`}
    >
      {isIncome ? (
        <ArrowDownLeft className="h-5 w-5" />
      ) : (
        <ArrowUpRight className="h-5 w-5" />
      )}
    </div>
  );
}

export default function StatCards() {
  const stats = [
    {
      variant: 'balance',
      label: 'Total balance',
      amount: '$870,000.00',
      footer: (
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4" /> On track
        </span>
      ),
    },
    {
      variant: 'income',
      label: 'Income',
      amount: '$1,000,000.00',
      footer: '+12% from last month',
    },
    {
      variant: 'expenses',
      label: 'Expenses',
      amount: '$130,000.00',
      footer: '-5% from last month',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {stats.map((stat) => {
        const v = VARIANTS[stat.variant];
        return (
          <div
            key={stat.variant}
            className={`relative overflow-hidden rounded-2xl p-6 shadow-sm ${v.bg}`}
          >
            <div className="flex items-start justify-between">
              <span className={`text-sm font-medium ${v.label}`}>{stat.label}</span>
              <IconBadge variant={stat.variant} />
            </div>
            <p className={`mt-3 text-3xl font-bold tracking-tight ${v.amount}`}>
              {stat.amount}
            </p>
            <p className={`mt-4 text-sm ${v.trend}`}>{stat.footer}</p>
          </div>
        );
      })}
    </div>
  );
}