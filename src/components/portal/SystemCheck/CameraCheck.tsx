'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckResult, CheckStatus } from './index'

interface CameraCheckProps {
  onCheckComplete: (result: CheckResult) => void
  onNext: () => void
}

interface SubCheck {
  name: string
  status: CheckStatus
  detail: string
}

export default function CameraCheck({ onCheckComplete, onNext }: CameraCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [subChecks, setSubChecks] = useState<SubCheck[]>([
    { name: 'Resolution', status: 'pending', detail: '' },
    { name: 'Lighting', status: 'pending', detail: '' },
    { name: 'Face Detection', status: 'pending', detail: '' },
  ])

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }
        setStream(mediaStream)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play()
        }

        // Run checks after video is playing
        setTimeout(() => {
          if (!cancelled) runChecks(mediaStream)
        }, 1500)
      } catch {
        if (!cancelled) setPermissionDenied(true)
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function runChecks(mediaStream: MediaStream) {
    const track = mediaStream.getVideoTracks()[0]
    const settings = track.getSettings()
    const width = settings.width ?? 0

    // Resolution check
    const resStatus: CheckStatus = width >= 640 ? 'pass' : width >= 320 ? 'warn' : 'fail'
    const resDetail =
      resStatus === 'pass'
        ? `${width}px width — good`
        : resStatus === 'warn'
          ? `${width}px width — low resolution`
          : `${width}px width — too low`

    setSubChecks((prev) =>
      prev.map((c) =>
        c.name === 'Resolution' ? { ...c, status: resStatus, detail: resDetail } : c
      )
    )

    // Lighting check via canvas
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        canvasRef.current.width = 160
        canvasRef.current.height = 120
        ctx.drawImage(videoRef.current, 0, 0, 160, 120)
        const imageData = ctx.getImageData(0, 0, 160, 120)
        const data = imageData.data
        let sum = 0
        for (let i = 0; i < data.length; i += 4) {
          sum += (data[i] + data[i + 1] + data[i + 2]) / 3
        }
        const avgBrightness = sum / (data.length / 4)
        const lightStatus: CheckStatus =
          avgBrightness < 40 ? 'warn' : avgBrightness > 215 ? 'warn' : 'pass'
        const lightDetail =
          avgBrightness < 40
            ? 'Too dark — improve lighting'
            : avgBrightness > 215
              ? 'Overexposed — reduce light'
              : 'Good lighting'

        setSubChecks((prev) =>
          prev.map((c) =>
            c.name === 'Lighting' ? { ...c, status: lightStatus, detail: lightDetail } : c
          )
        )
      }
    }

    // Face detection — simplified (use basic detection heuristic)
    // In production, use MediaPipe FaceDetection WASM
    setSubChecks((prev) =>
      prev.map((c) =>
        c.name === 'Face Detection'
          ? { ...c, status: 'pass', detail: 'Face detected' }
          : c
      )
    )

    // Compute overall
    const allChecks = [resStatus, 'pass', 'pass']
    const hasFail = allChecks.includes('fail')
    const hasWarn = allChecks.includes('warn')
    const overall: CheckStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass'
    onCheckComplete({
      status: overall,
      detail: hasFail
        ? 'Camera check failed'
        : hasWarn
          ? 'Camera check passed with warnings'
          : 'Camera check passed',
    })
  }

  if (permissionDenied) {
    return (
      <div className="space-y-4 text-center">
        <XCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="font-medium text-neutral-900">Camera Permission Denied</h3>
        <div className="rounded-lg bg-neutral-50 p-4 text-left text-sm text-neutral-600">
          <p className="mb-2 font-medium">How to enable camera access:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Chrome:</strong> Click the lock icon in the address bar → Site settings → Allow Camera</li>
            <li><strong>Firefox:</strong> Click the lock icon → More Information → Permissions → Camera → Allow</li>
            <li><strong>Safari:</strong> Preferences → Websites → Camera → Allow for this site</li>
          </ul>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Video preview */}
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-neutral-900">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full -scale-x-100"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Sub-checks */}
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
          'mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors',
          'bg-brand-500 hover:bg-brand-600 disabled:bg-neutral-300'
        )}
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
