'use client'

import { useEffect, useState } from 'react'
import { Monitor, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { CheckResult, CheckStatus } from './index'

interface BrowserCheckProps {
  onCheckComplete: (result: CheckResult) => void
  onNext: () => void
}

interface BrowserInfo {
  name: string
  version: string
  supported: boolean
}

function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent
  let name = 'Unknown'
  let version = '0'

  if (ua.includes('Edg/')) {
    name = 'Edge'
    version = ua.match(/Edg\/([\d.]+)/)?.[1] ?? '0'
  } else if (ua.includes('Chrome/')) {
    name = 'Chrome'
    version = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? '0'
  } else if (ua.includes('Firefox/')) {
    name = 'Firefox'
    version = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? '0'
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    name = 'Safari'
    version = ua.match(/Version\/([\d.]+)/)?.[1] ?? '0'
  }

  const major = parseInt(version.split('.')[0], 10)
  const supported =
    (name === 'Chrome' && major >= 90) ||
    (name === 'Edge' && major >= 90) ||
    (name === 'Firefox' && major >= 100) ||
    (name === 'Safari' && major >= 15)

  return { name, version, supported }
}

interface FeatureCheck {
  label: string
  status: CheckStatus
  detail: string
}

export default function BrowserCheck({ onCheckComplete, onNext }: BrowserCheckProps) {
  const [browser, setBrowser] = useState<BrowserInfo | null>(null)
  const [features, setFeatures] = useState<FeatureCheck[]>([])

  useEffect(() => {
    const info = detectBrowser()
    setBrowser(info)

    const checks: FeatureCheck[] = []

    // Screen sharing
    const hasScreenShare =
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
    checks.push({
      label: 'Screen Sharing',
      status: hasScreenShare ? 'pass' : 'fail',
      detail: hasScreenShare ? 'getDisplayMedia available' : 'Not supported',
    })

    // WebAssembly
    const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'
    checks.push({
      label: 'WebAssembly',
      status: hasWasm ? 'pass' : 'fail',
      detail: hasWasm ? 'Available' : 'Not supported',
    })

    // Session Storage
    let hasStorage = false
    try {
      sessionStorage.setItem('__test__', '1')
      sessionStorage.removeItem('__test__')
      hasStorage = true
    } catch {
      hasStorage = false
    }
    checks.push({
      label: 'Session Storage',
      status: hasStorage ? 'pass' : 'fail',
      detail: hasStorage ? 'Available' : 'Blocked (check privacy settings)',
    })

    // Fullscreen API
    const hasFullscreen =
      typeof document.documentElement.requestFullscreen === 'function' ||
      // @ts-expect-error vendor prefix
      typeof document.documentElement.webkitRequestFullscreen === 'function'
    checks.push({
      label: 'Fullscreen API',
      status: hasFullscreen ? 'pass' : 'warn',
      detail: hasFullscreen ? 'Available' : 'Not available (optional)',
    })

    // MediaRecorder
    const hasRecorder = typeof window.MediaRecorder !== 'undefined'
    checks.push({
      label: 'MediaRecorder',
      status: hasRecorder ? 'pass' : 'fail',
      detail: hasRecorder ? 'Available' : 'Not supported',
    })

    // Browser version check
    const browserStatus: CheckStatus = info.supported ? 'pass' : 'warn'

    setFeatures(checks)

    const allStatuses = [...checks.map((c) => c.status), browserStatus]
    const hasFail = allStatuses.includes('fail')
    const hasWarn = allStatuses.includes('warn')
    onCheckComplete({
      status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
      detail: hasFail
        ? 'Browser missing required features'
        : hasWarn
          ? 'Browser check passed with warnings'
          : 'Browser check passed',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      {/* Browser info */}
      {browser && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex items-center gap-4">
          <Monitor className="h-8 w-8 text-neutral-400" />
          <div>
            <p className="text-sm font-medium text-neutral-800">
              {browser.name} v{browser.version}
            </p>
            <p className={`text-xs ${browser.supported ? 'text-green-600' : 'text-amber-600'}`}>
              {browser.supported ? 'Supported browser' : 'Older version — may work but not guaranteed'}
            </p>
          </div>
        </div>
      )}

      {/* Feature checks */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
        {features.map((f) => (
          <div key={f.label} className="flex items-center gap-3 text-sm">
            <StatusIcon status={f.status} />
            <span className="text-neutral-700 font-medium">{f.label}</span>
            <span className="ml-auto text-xs text-neutral-500">{f.detail}</span>
          </div>
        ))}
      </div>

      {features.some((f) => f.status === 'fail') && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm font-medium text-red-800 mb-1">Required Features Missing</p>
          <p className="text-xs text-red-700">
            Please use the latest version of Chrome, Edge, or Firefox for the best experience.
          </p>
        </div>
      )}

      <button
        onClick={onNext}
        className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:bg-neutral-300"
      >
        Continue
      </button>
    </div>
  )
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === 'warn') return <AlertTriangle className="h-5 w-5 text-amber-500" />
  if (status === 'fail') return <XCircle className="h-5 w-5 text-red-500" />
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500" />
}
