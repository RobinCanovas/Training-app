import { useState } from 'react';
import { Card, Btn, cx } from './ui.jsx';

// Palette catégorielle validée (sombre, surface #121A2C) : orange · bleu · turquoise
export const C = { grid: '#243049', tick: '#93A0B8', orange: '#e76624', blue: '#338ced', aqua: '#00a888', surface: '#121A2C' };

export function ChartTip({ active, payload, label, fmt, title }) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter((p) => p.value != null);
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2 shadow-lg text-[13px]" style={{ minWidth: 150 }}>
      <div className="text-muted mb-1">{title(label)}</div>
      {rows.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-3.5 h-[3px] rounded flex-none" style={{ background: p.color }} />
          <b className="text-[15px] num">{fmt(p.value, p.dataKey)}</b>
          <span className="text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export function Key({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted mb-2" role="list">
      {items.map((k) => (
        <span key={k.name} role="listitem" className="inline-flex items-center gap-1.5">
          {k.bar ? <span className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: k.color }} /> : <span className="inline-block w-4 h-[3px] rounded" style={{ background: k.color }} />}
          {k.name}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({ title, sub, legend, table, children, empty }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card title={title} icon="ChartLine" right={!empty && <Btn size="sm" icon={asTable ? 'ChartLine' : 'Table'} onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>{asTable ? 'Courbe' : 'Tableau'}</Btn>}>
      {sub && <div className="text-[13px] text-muted -mt-0.5 mb-2.5 leading-snug">{sub}</div>}
      {empty ? empty : asTable ? table : (<>{legend && <Key items={legend} />}{children}</>)}
    </Card>
  );
}

export function DataTable({ head, rows }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[13.5px] num">
        <thead><tr>{head.map((h, i) => <th key={i} className={cx('lbl py-1.5 px-1', i ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className={cx('py-1.5 px-1', j ? 'text-right' : 'text-left font-semibold')}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export const axis = { tick: { fill: C.tick, fontSize: 12 }, axisLine: { stroke: C.grid }, tickLine: false };

