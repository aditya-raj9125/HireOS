'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import type { FunnelStage } from '@/types'

interface Props {
  data: FunnelStage[]
}

const COLORS = [
  '#0F9B77', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5',
]

export function FunnelChart({ data }: Props) {
  return (
    <Card padding="md">
      <h3 className="mb-4 text-sm font-medium text-neutral-900">
        Hiring Funnel
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" barCategoryGap={8}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#a3a3a3' }} />
          <YAxis
            type="category"
            dataKey="stage"
            width={120}
            tick={{ fontSize: 12, fill: '#525252' }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              fontSize: 12,
              border: '1px solid #e5e5e5',
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((_entry, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
