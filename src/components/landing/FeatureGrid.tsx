'use client'

export function FeatureGrid() {
  return (
    <section id="product" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-xs font-semibold tracking-[0.2em] text-brand-500 uppercase">
          Platform
        </p>
        <h2 className="mx-auto mt-4 max-w-2xl text-center text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl lg:text-[48px] lg:leading-[1.15]">
          Full-Stack Interview Platform
        </h2>

        {/* Bento Grid */}
        <div className="mt-14 grid gap-4 md:grid-cols-12 md:grid-rows-3">
          {/* Feature 1 — Large card: Live Coding + AI Follow-Up */}
          <div className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card transition-all duration-200 hover:scale-[1.01] hover:shadow-md md:col-span-7 md:row-span-2">
            <div className="flex h-full flex-col justify-between p-6">
              <div>
                <div className="mb-4 h-1 w-12 rounded-full bg-brand-500" />
                <h3 className="text-lg font-medium text-neutral-900">
                  Live Coding + Real-Time AI Follow-Up
                </h3>
                <p className="mt-2 text-sm text-neutral-500">
                  Full IDE environment with adaptive questioning. The AI adjusts difficulty based on candidate responses in real-time.
                </p>
              </div>
              {/* IDE mockup */}
              <div className="mt-4 overflow-hidden rounded-lg bg-neutral-900 p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2.5 w-3/4 rounded bg-purple-400/30" />
                  <div className="h-2.5 w-1/2 rounded bg-blue-400/30" />
                  <div className="h-2.5 w-2/3 rounded bg-brand-400/30" />
                  <div className="h-2.5 w-5/6 rounded bg-brand-400/30" />
                  <div className="h-2.5 w-1/3 rounded bg-neutral-600/30" />
                </div>
                <div className="mt-3 rounded border border-brand-500/30 bg-brand-500/10 p-2">
                  <p className="text-xs text-brand-300">
                    AI: &quot;Can you explain the time complexity of your approach?&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 — Anti-Cheat Proctoring */}
          <div className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card transition-all duration-200 hover:scale-[1.01] hover:shadow-md md:col-span-5 md:row-span-1">
            <div className="p-6">
              <div className="mb-4 h-1 w-12 rounded-full bg-purple-500" />
              <h3 className="text-lg font-medium text-neutral-900">
                Anti-Cheat Proctoring Engine
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                Tab-switching detection, copy-paste monitoring, and AI-powered code similarity checks.
              </p>
              {/* Integrity gauge */}
              <div className="mt-4 flex items-center justify-center">
                <svg className="h-24 w-24" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#e7e5e4"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#0F9B77"
                    strokeWidth="8"
                    strokeDasharray={`${0.94 * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                  <text
                    x="50"
                    y="48"
                    textAnchor="middle"
                    className="fill-neutral-900 text-lg font-medium"
                    fontSize="16"
                  >
                    94%
                  </text>
                  <text
                    x="50"
                    y="62"
                    textAnchor="middle"
                    className="fill-neutral-400"
                    fontSize="8"
                  >
                    Integrity
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Feature 3 — Whiteboard System Design */}
          <div className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card transition-all duration-200 hover:scale-[1.01] hover:shadow-md md:col-span-5 md:row-span-1">
            <div className="p-6">
              <div className="mb-4 h-1 w-12 rounded-full bg-amber-500" />
              <h3 className="text-lg font-medium text-neutral-900">
                Whiteboard System Design
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                Interactive canvas for architecture diagrams with real-time AI evaluation.
              </p>
              {/* Mini whiteboard */}
              <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <svg className="h-20 w-full" viewBox="0 0 200 80">
                  {/* Boxes */}
                  <rect x="10" y="10" width="50" height="25" rx="4" fill="none" stroke="#d6d3d1" strokeWidth="1.5" />
                  <rect x="80" y="25" width="50" height="25" rx="4" fill="none" stroke="#0F9B77" strokeWidth="1.5" />
                  <rect x="150" y="10" width="40" height="25" rx="4" fill="none" stroke="#d6d3d1" strokeWidth="1.5" />
                  <rect x="150" y="45" width="40" height="25" rx="4" fill="none" stroke="#d6d3d1" strokeWidth="1.5" />
                  {/* Arrows */}
                  <line x1="60" y1="22" x2="80" y2="37" stroke="#0F9B77" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  <line x1="130" y1="32" x2="150" y2="22" stroke="#0F9B77" strokeWidth="1.5" />
                  <line x1="130" y1="42" x2="150" y2="52" stroke="#0F9B77" strokeWidth="1.5" />
                  <text x="20" y="26" fontSize="7" fill="#78716C">Client</text>
                  <text x="92" y="41" fontSize="7" fill="#0F9B77">API</text>
                  <text x="157" y="26" fontSize="7" fill="#78716C">DB</text>
                  <text x="153" y="61" fontSize="7" fill="#78716C">Cache</text>
                </svg>
              </div>
            </div>
          </div>

          {/* Feature 4 — HR Pipeline Builder */}
          <div className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card transition-all duration-200 hover:scale-[1.01] hover:shadow-md md:col-span-4 md:row-span-1">
            <div className="p-6">
              <div className="mb-4 h-1 w-12 rounded-full bg-brand-500" />
              <h3 className="text-lg font-medium text-neutral-900">
                HR Pipeline Builder
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                Drag-and-drop round sequencing with per-round configuration.
              </p>
              <div className="mt-4 space-y-2">
                {['OA', 'Live Coding', 'System Design'].map((round, i) => (
                  <div
                    key={round}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 text-[10px] font-bold text-brand-700">
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium text-neutral-700">
                      {round}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 5 — AI Report Card */}
          <div className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card transition-all duration-200 hover:scale-[1.01] hover:shadow-md md:col-span-4 md:row-span-1">
            <div className="p-6">
              <div className="mb-4 h-1 w-12 rounded-full bg-purple-500" />
              <h3 className="text-lg font-medium text-neutral-900">
                AI Report Card
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                Detailed per-skill breakdown with AI justification for every score.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { skill: 'Problem Solving', score: 87 },
                  { skill: 'Code Quality', score: 72 },
                  { skill: 'Communication', score: 91 },
                ].map((item) => (
                  <div key={item.skill}>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-600">{item.skill}</span>
                      <span className="font-medium text-neutral-900">
                        {item.score}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100">
                      <div
                        className="h-1.5 rounded-full bg-brand-500"
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 6 — Zero-Code Dashboard */}
          <div className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card transition-all duration-200 hover:scale-[1.01] hover:shadow-md md:col-span-4 md:row-span-1">
            <div className="p-6">
              <div className="mb-4 h-1 w-12 rounded-full bg-brand-500" />
              <h3 className="text-lg font-medium text-neutral-900">
                Zero-Code Analytics
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                Real-time hiring funnel analytics, source tracking, and performance insights.
              </p>
              {/* Mini chart */}
              <div className="mt-4 flex items-end gap-1.5">
                {[40, 65, 50, 80, 70, 90, 85].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-brand-200"
                    style={{ height: `${h * 0.6}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
