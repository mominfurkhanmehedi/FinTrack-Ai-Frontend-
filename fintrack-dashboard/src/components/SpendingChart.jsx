import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (value) => '$' + Number(value).toLocaleString('en-US');

const data = [
  { day: 'Thu', income: 0, expenses: 0 },
  { day: 'Fri', income: 0, expenses: 0 },
  { day: 'Sat', income: 0, expenses: 0 },
  { day: 'Sun', income: 0, expenses: 0 },
  { day: 'Mon', income: 0, expenses: 0 },
  { day: 'Tue', income: 0, expenses: 0 },
  { day: 'Wed', income: 1000000, expenses: 130000 },
];

function BarLabel(props) {
  const { x, y, width, height, value, index, stroke } = props;
  if (!value || value === 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fontSize={12}
      fontWeight={600}
      fill={stroke}
    >
      {fmt(value)}
    </text>
  );
}

export default function SpendingChart() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Spending overview</h2>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Expenses
          </span>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              dy={8}
            />
            <YAxis
              domain={[0, 1000000]}
              axisLine={false}
              tickLine={false}
              width={56}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(v) => '$' + v / 1000 + 'k'}
            />
            <Tooltip
              cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
              formatter={(value, name) => [fmt(value), name === 'income' ? 'Income' : 'Expenses']}
              contentStyle={{
                borderRadius: 12,
                borderColor: '#e5e7eb',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="income"
              fill="#10b981"
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
              label={<BarLabel stroke="#059669" />}
            />
            <Bar
              dataKey="expenses"
              fill="#f43f5e"
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
              label={<BarLabel stroke="#e11d48" />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}