'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import type { SourceBreakdown } from '@/types'

interface Props {
  data: SourceBreakdown[]
}

const COLORS = ['#0F9B77', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

export function SourcePieChart({ data }: Props) {
  return (
    <Card padding="md">
      <h3 className="mb-4 text-sm font-medium text-neutral-900">
        Candidate Sources
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="count"
            nameKey="source"
          >
            {data.map((_entry, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              fontSize: 12,
              border: '1px solid #e5e5e5',
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-neutral-600 capitalize">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}
