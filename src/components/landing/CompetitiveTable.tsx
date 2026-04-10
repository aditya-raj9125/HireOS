import { Check, X, Minus } from 'lucide-react'

type CellValue = 'yes' | 'no' | 'partial'

interface ComparisonRow {
  feature: string
  hireos: CellValue
  alex: CellValue
  interviewerAI: CellValue
  hireVue: CellValue
}

const rows: ComparisonRow[] = [
  { feature: 'Live Coding IDE', hireos: 'yes', alex: 'no', interviewerAI: 'no', hireVue: 'no' },
  { feature: 'System Design Whiteboard', hireos: 'yes', alex: 'no', interviewerAI: 'no', hireVue: 'no' },
  { feature: 'AI Voice Interviewer', hireos: 'yes', alex: 'yes', interviewerAI: 'partial', hireVue: 'partial' },
  { feature: 'Real-Time Follow-Up Questions', hireos: 'yes', alex: 'partial', interviewerAI: 'no', hireVue: 'no' },
  { feature: 'Anti-Cheat Proctoring', hireos: 'yes', alex: 'no', interviewerAI: 'partial', hireVue: 'yes' },
  { feature: 'Per-Skill Scoring Rubric', hireos: 'yes', alex: 'partial', interviewerAI: 'no', hireVue: 'partial' },
  { feature: 'HR Pipeline Builder', hireos: 'yes', alex: 'no', interviewerAI: 'no', hireVue: 'partial' },
  { feature: 'Candidate Link Shareability', hireos: 'yes', alex: 'yes', interviewerAI: 'yes', hireVue: 'yes' },
  { feature: 'Multi-Round Orchestration', hireos: 'yes', alex: 'no', interviewerAI: 'no', hireVue: 'partial' },
  { feature: 'Deep Technical Evaluation', hireos: 'yes', alex: 'no', interviewerAI: 'no', hireVue: 'no' },
]

function CellIcon({ value }: { value: CellValue }) {
  if (value === 'yes')
    return <Check className="mx-auto h-4 w-4 text-brand-500" />
  if (value === 'no')
    return <X className="mx-auto h-4 w-4 text-red-400" />
  return <Minus className="mx-auto h-4 w-4 text-amber-400" />
}

export function CompetitiveTable() {
  return (
    <section className="bg-neutral-50 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-xs font-semibold tracking-[0.2em] text-brand-500 uppercase">
          Why HireOS
        </p>
        <h2 className="mx-auto mt-4 max-w-2xl text-center text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl lg:text-[48px] lg:leading-[1.15]">
          How HireOS Compares
        </h2>

        {/* Table */}
        <div className="mt-14 overflow-x-auto">
          <div className="min-w-[640px] overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b border-neutral-200 bg-white px-4 py-3 text-left font-medium text-neutral-500">
                    Feature
                  </th>
                  <th className="border-b border-neutral-200 bg-brand-500 px-4 py-3 text-center font-medium text-white">
                    HireOS
                  </th>
                  <th className="border-b border-neutral-200 bg-white px-4 py-3 text-center font-medium text-neutral-500">
                    Alex (Apriora)
                  </th>
                  <th className="border-b border-neutral-200 bg-white px-4 py-3 text-center font-medium text-neutral-500">
                    Interviewer.AI
                  </th>
                  <th className="border-b border-neutral-200 bg-white px-4 py-3 text-center font-medium text-neutral-500">
                    HireVue
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i % 2 === 1 ? 'bg-neutral-50' : 'bg-white'}
                  >
                    <td className="px-4 py-3 font-medium text-neutral-700">
                      {row.feature}
                    </td>
                    <td className="bg-brand-50/50 px-4 py-3 text-center">
                      <CellIcon value={row.hireos} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CellIcon value={row.alex} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CellIcon value={row.interviewerAI} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CellIcon value={row.hireVue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Callout */}
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-medium text-green-700">
            HireOS is the only platform built for deep technical hiring — from
            OA to system design, fully autonomous.
          </p>
        </div>
      </div>
    </section>
  )
}
