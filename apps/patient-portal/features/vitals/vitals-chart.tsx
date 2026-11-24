'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {ObservationItem} from '@/lib/api/workspace-client';
import {formatVnTime, MC_COLORS} from '@/lib/design-tokens';

export function VitalsChart({items}: {items: ObservationItem[]}) {
  const chartData = items.map((item) => ({
    time: formatVnTime(item.measuredAt),
    label: item.label,
    value: item.value,
    unit: item.unit,
  }));

  if (chartData.length === 0) {
    return (
      <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textMuted}}>
        Chưa có đủ điểm dữ liệu sinh hiệu để hiển thị biểu đồ xu hướng.
      </p>
    );
  }

  return (
    <section aria-label="Biểu đồ xu hướng chỉ số sinh hiệu" style={{width: '100%', height: 240}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{top: 10, right: 16, left: 0, bottom: 0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2ece9" />
          <XAxis dataKey="time" tick={{fontSize: 12, fill: MC_COLORS.textMuted}} />
          <YAxis tick={{fontSize: 12, fill: MC_COLORS.textMuted}} width={44} />
          <Tooltip
            contentStyle={{
              borderRadius: '10px',
              borderColor: MC_COLORS.mintBorder,
              fontSize: '13px',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={MC_COLORS.brandPrimary}
            strokeWidth={2.5}
            dot={{r: 4, fill: MC_COLORS.brandPrimary}}
            activeDot={{r: 6}}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
