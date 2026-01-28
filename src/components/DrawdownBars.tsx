import { getDrawdownZone } from '../utils/drawdown';

interface Props {
  label: string;
  currentPct: number;
  softLimit?: number;
  hardLimit: number;
}

const ZONE_COLORS = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' };

export default function DrawdownBars({ label, currentPct, softLimit, hardLimit }: Props) {
  const zone = getDrawdownZone(currentPct, hardLimit);
  const fillPct = Math.min((currentPct / hardLimit) * 100, 100);
  const softMarkerPct = softLimit ? (softLimit / hardLimit) * 100 : null;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className={`font-mono font-bold ${
          zone === 'red' ? 'text-red-400' : zone === 'yellow' ? 'text-yellow-400' : 'text-green-400'
        }`}>
          {currentPct.toFixed(2)}% / {hardLimit}%
        </span>
      </div>
      <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${ZONE_COLORS[zone]}`}
          style={{ width: `${fillPct}%` }}
        />
        {softMarkerPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-300 opacity-80"
            style={{ left: `${softMarkerPct}%` }}
            title={`Soft limit: ${softLimit}%`}
          />
        )}
      </div>
      {softLimit && (
        <div className="text-xs text-slate-500 mt-0.5">
          Soft: {softLimit}% | Hard: {hardLimit}%
        </div>
      )}
    </div>
  );
}
