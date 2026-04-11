'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react'
import type { CheckResult, CheckStatus } from './index'

interface ReadinessConfirmProps {
  results: {
    camera: CheckResult | null
    mic: CheckResult | null
    network: CheckResult | null
    browser: CheckResult | null
  }
  token: string
  onBegin: () => void
}

export default function ReadinessConfirm({ results, token, onBegin }: ReadinessConfirmProps) {
  const [consent, setConsent] = useState(false)
  const [ackWarnings, setAckWarnings] = useState(false)
  const [ackFailures, setAckFailures] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const entries = [
    { label: 'Camera', result: results.camera },
    { label: 'Microphone', result: results.mic },
    { label: 'Network', result: results.network },
    { label: 'Browser', result: results.browser },
  ]

  const hasAnyFail = entries.some((e) => e.result?.status === 'fail')
  const hasAnyWarn = entries.some((e) => e.result?.status === 'warn')
  const allPass = entries.every((e) => e.result?.status === 'pass')

  // ackFailures implicitly covers warnings — only require ackWarnings when there are no failures
  const canProceed = consent && (!hasAnyFail || ackFailures) && (!hasAnyWarn || ackWarnings || ackFailures)

  async function handleBegin() {
    setSubmitting(true)
    try {
      const overallPass = entries.every((e) => e.result?.status === 'pass')
      await fetch(`/api/portal/${token}/system-check-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraResult: results.camera ?? {},
          micResult: results.mic ?? {},
          networkResult: results.network ?? {},
          browserResult: results.browser ?? {},
          overallPass,
        }),
      })
      onBegin()
    } catch {
      // Allow proceeding even if save fails — the interview is more important
      onBegin()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary table */}
      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
        {entries.map(({ label, result }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3 text-sm">
            <StatusIcon status={result?.status ?? 'pending'} />
            <span className="font-medium text-neutral-800">{label}</span>
            <span className="ml-auto text-xs text-neutral-500">
              {result?.detail ?? 'Not checked'}
            </span>
          </div>
        ))}
      </div>

      {/* Failed checks — acknowledgment required */}
      {hasAnyFail && (
        <label className="flex gap-3 items-start rounded-lg bg-red-50 border border-red-200 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={ackFailures}
            onChange={(e) => setAckFailures(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
          />
          <div>
            <p className="text-sm font-medium text-red-800">Some checks failed — proceed anyway?</p>
            <ul className="mt-1 text-xs text-red-700 list-disc ml-4 space-y-0.5">
              {entries
                .filter((e) => e.result?.status === 'fail')
                .map((e) => (
                  <li key={e.label}>
                    <strong>{e.label}:</strong> {e.result?.detail}
                  </li>
                ))}
            </ul>
            <p className="mt-1 text-xs text-red-600">
              Check the box to acknowledge and continue. Your assessment experience may be affected.
            </p>
          </div>
        </label>
      )}

      {/* Warning acknowledgment */}
      {hasAnyWarn && !hasAnyFail && (
        <label className="flex gap-3 items-start rounded-lg bg-amber-50 border border-amber-200 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={ackWarnings}
            onChange={(e) => setAckWarnings(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
          />
          <div>
            <p className="text-sm font-medium text-amber-800">Some checks have warnings</p>
            <p className="text-xs text-amber-700">
              Your interview may be affected. Check the issues above and acknowledge to proceed.
            </p>
          </div>
        </label>
      )}

      {/* All pass banner */}
      {allPass && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-3">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">All checks passed — you&apos;re all set!</p>
        </div>
      )}

      {/* Consent */}
      <label className="flex gap-3 items-start cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
        />
        <p className="text-xs text-neutral-600">
          I understand this interview will be recorded (audio & screen). I consent to AI-assisted
          evaluation of my responses. I agree to the{' '}
          <a href="/terms" className="underline text-brand-600" target="_blank">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline text-brand-600" target="_blank">
            Privacy Policy
          </a>
          .
        </p>
      </label>

      {/* Begin button */}
      <button
        onClick={handleBegin}
        disabled={!canProceed || submitting}
        className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Starting...' : 'Begin Interview'}
      </button>
    </div>
  )
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === 'warn') return <AlertTriangle className="h-5 w-5 text-amber-500" />
  if (status === 'fail') return <XCircle className="h-5 w-5 text-red-500" />
  return <div className="h-5 w-5 rounded-full bg-neutral-200" />
}
