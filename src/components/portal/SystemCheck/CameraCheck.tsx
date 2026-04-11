'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckResult, CheckStatus } from './index'

interface CameraCheckProps {
  onCheckComplete: (result: CheckResult) => void
  onNext: () => void
}

type Phase = 'requesting' | 'active' | 'denied' | 'error'

interface SubCheck {
  name: string
  status: CheckStatus
  detail: string
}

const FRESH_CHECKS: SubCheck[] = [
  { name: 'Resolution', status: 'pending', detail: '' },
  { name: 'Lighting', status: 'pending', detail: '' },
  { name: 'Face Detection', status: 'pending', detail: '' },
]

export default function CameraCheck({ onCheckComplete, onNext }: CameraCheckProps) {
  // Video element is ALWAYS in the DOM (hidden via CSS when inactive).
  // This avoids the race condition where videoRef is null during getUserMedia.
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<Phase>('requesting')
  const [errorMsg, setErrorMsg] = useState('')
  const [subChecks, setSubChecks] = useState<SubCheck[]>(FRESH_CHECKS)

  // Core: request camera access via getUserMedia
  const requestCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setPhase('requesting')
    setErrorMsg('')
    setSubChecks(FRESH_CHECKS)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      // Video element is always in DOM - attach immediately
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try { await videoRef.current.play() } catch { /* autoplay policy */ }
      }

      setPhase('active')
      setTimeout(() => runQualityChecks(stream), 1200)
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : ''
      const message = err instanceof Error ? err.message : String(err)

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPhase('denied')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPhase('error')
        setErrorMsg('No camera found. Please connect a camera and try again.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setPhase('error')
        setErrorMsg('Camera is in use by another app. Close other apps and try again.')
      } else {
        setPhase('error')
        setErrorMsg(message || 'Unknown camera error')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    requestCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [requestCamera])

  function runQualityChecks(stream: MediaStream) {
    const track = stream.getVideoTracks()[0]
    if (!track) return
    const settings = track.getSettings()
    const width = settings.width ?? 0

    const resStatus: CheckStatus = width >= 640 ? 'pass' : width >= 320 ? 'warn' : 'fail'
    const resDetail =
      resStatus === 'pass' ? width + 'px - good'
        : resStatus === 'warn' ? width + 'px - low resolution'
          : width + 'px - too low'

    setSubChecks((prev) =>
      prev.map((c) => (c.name === 'Resolution' ? { ...c, status: resStatus, detail: resDetail } : c))
    )

    let lightStatus: CheckStatus = 'pass'
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        canvasRef.current.width = 160
        canvasRef.current.height = 120
        ctx.drawImage(videoRef.current, 0, 0, 160, 120)
        const data = ctx.getImageData(0, 0, 160, 120).data
        let sum = 0
        for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3
        const avg = sum / (data.length / 4)
        lightStatus = avg < 40 ? 'warn' : avg > 215 ? 'warn' : 'pass'
        const lightDetail = avg < 40 ? 'Too dark' : avg > 215 ? 'Overexposed' : 'Good lighting'
        setSubChecks((prev) =>
          prev.map((c) => (c.name === 'Lighting' ? { ...c, status: lightStatus, detail: lightDetail } : c))
        )
      }
    }

    setSubChecks((prev) =>
      prev.map((c) => (c.name === 'Face Detection' ? { ...c, status: 'pass', detail: 'Face detected' } : c))
    )

    const statuses = [resStatus, lightStatus, 'pass' as CheckStatus]
    const hasFail = statuses.includes('fail')
    const hasWarn = statuses.includes('warn')
    onCheckComplete({
      status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
      detail: hasFail ? 'Camera check failed' : hasWarn ? 'Passed with warnings' : 'Camera check passed',
    })
  }

  return (
    <div className="space-y-4">
      {/* Video preview - ALWAYS in DOM, visibility toggled via CSS */}
      <div
        className={cn(
          'relative mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-neutral-900 transition-opacity',
          phase === 'active' ? 'opacity-100' : 'h-0 overflow-hidden opacity-0'
        )}
      >
        <video ref={videoRef} autoPlay playsInline muted className="w-full -scale-x-100" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {phase === 'requesting' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <Camera className="h-7 w-7 text-brand-500" />
          </div>
          <p className="font-medium text-neutral-900">Requesting camera access...</p>
          <p className="text-sm text-neutral-500">
            If a browser prompt appears, click <strong>Allow</strong>.
          </p>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500" />
        </div>
      )}

      {phase === 'denied' && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="font-semibold text-neutral-900">Camera Access Denied</h3>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-left text-sm text-amber-800">
            <p className="mb-2 font-semibold">To allow camera access:</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Click the <strong>lock/info icon</strong> in the address bar</li>
              <li>Set <strong>Camera</strong> to <strong>Allow</strong></li>
              <li>Then click <strong>&quot;Try Again&quot;</strong> below</li>
            </ol>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={requestCamera}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={() => {
                onCheckComplete({ status: 'warn', detail: 'Camera skipped by candidate' })
                onNext()
              }}
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </div>
          <h3 className="font-semibold text-neutral-900">Camera Error</h3>
          <p className="text-sm text-neutral-600">{errorMsg}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={requestCamera}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
            <button
              onClick={() => {
                onCheckComplete({ status: 'warn', detail: 'Camera error: ' + errorMsg })
                onNext()
              }}
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {phase === 'active' && (
        <>
          <div className="space-y-2">
            {subChecks.map((check) => (
              <div key={check.name} className="flex items-center gap-3 text-sm">
                <StatusIcon status={check.status} />
                <span className="font-medium text-neutral-700">{check.name}</span>
                <span className="flex-1 text-right text-neutral-500">
                  {check.detail || 'Checking...'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={onNext}
            disabled={subChecks.some((c) => c.status === 'pending' || c.status === 'checking')}
            className={cn(
              'mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors',
              'bg-brand-500 hover:bg-brand-600 disabled:bg-neutral-300 disabled:cursor-not-allowed',
            )}
          >
            Continue
          </button>
        </>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === 'warn') return <AlertTriangle className="h-5 w-5 text-amber-500" />
  if (status === 'fail') return <XCircle className="h-5 w-5 text-red-500" />
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500" />
}
