import { Clock, AlertTriangle, TrendingDown, Users } from 'lucide-react'

const problems = [
  {
    icon: Clock,
    stat: '1.5–3 hours stolen',
    title: 'Per interview, per engineer',
    description:
      'Senior engineers spend 6–12 hours/week on interviews instead of shipping code.',
  },
  {
    icon: AlertTriangle,
    stat: 'Inconsistent evaluation',
    title: 'No standard rubric',
    description:
      'Every interviewer grades differently. Candidate experience varies wildly.',
  },
  {
    icon: TrendingDown,
    stat: 'Hiring velocity ceiling',
    title: 'Pipeline bottleneck',
    description:
      'You can only hire as fast as your engineers can interview. Growth stalls.',
  },
  {
    icon: Users,
    stat: 'Bias in back-to-back rounds',
    title: 'Fatigue-driven decisions',
    description:
      'Interviewer fatigue after 3+ rounds leads to inconsistent, biased evaluations.',
  },
]

export function ProblemSection() {
  return (
    <section id="problem" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section label */}
        <p className="text-center text-xs font-semibold tracking-[0.2em] text-brand-500 uppercase">
          The Problem
        </p>

        {/* Headline */}
        <h2 className="mx-auto mt-4 max-w-3xl text-center text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl lg:text-[48px] lg:leading-[1.15]">
          Engineering Teams Are Drowning in Interview Bandwidth
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-center text-base text-neutral-500">
          Your best engineers are stuck in back-to-back interviews instead of building product.
        </p>

        {/* Problem cards */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {problems.map((problem) => {
            const Icon = problem.icon
            return (
              <div
                key={problem.stat}
                className="rounded-xl border border-neutral-200 border-l-[3px] border-l-red-400 bg-white p-6 shadow-card transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50">
                    <Icon className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-neutral-900">
                      {problem.stat}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-neutral-600">
                      {problem.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                      {problem.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
