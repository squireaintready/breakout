import { useState, useRef, useEffect } from 'react';
import { SUPPORTED_ASSETS } from '../utils/constants';
import type { PriceMap } from '../hooks/useKrakenPrices';

interface Props {
  value: string;
  onChange: (asset: string) => void;
  prices?: PriceMap;
}

export default function AssetPicker({ value, onChange, prices = {} }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = SUPPORTED_ASSETS.filter(a =>
    a.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => { setOpen(!open); setSearch(''); }}
        className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm text-left flex justify-between items-center">
        <span className="font-semibold">{value}</span>
        <span className="text-slate-400 text-xs">{prices[value] ? `$${prices[value].toLocaleString()}` : ''}</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-700 rounded-lg shadow-lg border border-slate-600 max-h-56 overflow-hidden flex flex-col">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search coin..."
            className="w-full bg-slate-600 px-3 py-2 text-sm outline-none border-b border-slate-500"
          />
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
            ) : (
              filtered.map(a => (
                <button key={a} type="button"
                  onClick={() => { onChange(a); setOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-1.5 text-sm text-left flex justify-between items-center hover:bg-slate-600 ${a === value ? 'bg-slate-600 text-blue-400' : ''}`}>
                  <span className="font-semibold">{a}</span>
                  {prices[a] && <span className="text-xs text-slate-400">${prices[a].toLocaleString()}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
