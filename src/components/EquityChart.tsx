import { useStore } from '../store/useStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function EquityChart() {
  const { equityHistory, balance } = useStore();

  // Build data from snapshots + current live balance
  const today = new Date().toISOString().slice(0, 10);
  const snapshots = equityHistory.filter(e => e.date !== today);
  const data = [
    ...snapshots.map(e => ({ date: e.date.slice(5), balance: Math.round(e.balance) })),
    { date: today.slice(5), balance: Math.round(balance) },
  ];


  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-400 mb-2">Equity Curve</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} />
          <Tooltip />
          <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} dot={data.length < 2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
