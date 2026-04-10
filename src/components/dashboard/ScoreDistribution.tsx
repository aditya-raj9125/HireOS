'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import type { ScoreDistributionBucket } from '@/types'

interface Props {
  data: ScoreDistributionBucket[]
}

export function ScoreDistribution({ data }: Props) {
  return (
    <Card padding="md">
      <h3 className="mb-4 text-sm font-medium text-neutral-900">
        Score Distribution
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barCategoryGap={4}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="range"
            tick={{ fontSize: 11, fill: '#a3a3a3' }}
          />
          <YAxis tick={{ fontSize: 12, fill: '#a3a3a3' }} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              fontSize: 12,
              border: '1px solid #e5e5e5',
            }}
          />
          <Bar dataKey="count" fill="#0F9B77" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
