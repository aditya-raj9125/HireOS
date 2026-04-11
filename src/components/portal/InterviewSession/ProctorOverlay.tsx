'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ProctorEvent, ProctorEventType } from '@/types'

interface ProctorOverlayProps {
  onProctorEvent: (event: ProctorEvent) => void
  videoStream: MediaStream | null
  enabled: boolean
}

export default function ProctorOverlay({
  onProctorEvent,
  videoStream,
  enabled,
}: ProctorOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const lastFaceResultRef = useRef<{ faces: number; ts: number }>({ faces: 1, ts: 0 })
  const consecutiveMissingRef = useRef(0)
  const [bannerText, setBannerText] = useState<string | null>(null)
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const emit = useCallback(
    (type: ProctorEventType, detail: string, severity: 'low' | 'medium' | 'high') => {
      const event: ProctorEvent = {
        type,
        detail,
        timestamp: Date.now(),
        severity,
      }
      onProctorEvent(event)
    },
    [onProctorEvent],
  )

  const showBanner = useCallback((text: string) => {
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current)
    setBannerText(text)
    bannerTimeoutRef.current = setTimeout(() => setBannerText(null), 4000)
  }, [])

  // ── Face detection loop (samples every 3s) ──
  useEffect(() => {
    if (!enabled || !videoStream) return

    const video = videoRef.current
    if (!video) return
    video.srcObject = videoStream
    video.play().catch(() => {})

    let stopped = false
    let faceInterval: ReturnType<typeof setInterval>

    // Try to use OffscreenCanvas in a Web Worker for perf
    const useWorker = typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined'

    const analyzeFrame = () => {
      if (stopped || !canvasRef.current || !video || video.readyState < 2) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = 160
      canvas.height = 120
      ctx.drawImage(video, 0, 0, 160, 120)

      // Simple face detection heuristic using skin-tone pixel analysis
      // (MediaPipe requires async WASM loading — we use a lightweight fallback)
      const imageData = ctx.getImageData(0, 0, 160, 120)
      const data = imageData.data
      let skinPixels = 0
      const totalPixels = data.length / 4

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        // HSV-based skin detection heuristic
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15 && r - b > 15) {
          skinPixels++
        }
      }

      const skinRatio = skinPixels / totalPixels

      // Rough face presence: expect >5% skin pixels when face is present
      const facesDetected = skinRatio > 0.05 ? 1 : 0

      if (facesDetected === 0) {
        consecutiveMissingRef.current++
        if (consecutiveMissingRef.current >= 2) {
          emit('face_missing', 'No face detected for consecutive samples', 'medium')
          showBanner('Please make sure your face is visible on camera.')
          consecutiveMissingRef.current = 0
        }
      } else {
        consecutiveMissingRef.current = 0
      }

      // High skin ratio might indicate multiple faces or very close face
      if (skinRatio > 0.35) {
        emit('multiple_faces', 'Unusually high face-area detected', 'high')
      }

      lastFaceResultRef.current = { faces: facesDetected, ts: Date.now() }
    }

    faceInterval = setInterval(analyzeFrame, 3000)

    return () => {
      stopped = true
      clearInterval(faceInterval)
    }
  }, [enabled, videoStream, emit, showBanner])

  // ── Tab/window focus monitoring ──
  useEffect(() => {
    if (!enabled) return

    let blurTimeout: ReturnType<typeof setTimeout>

    const handleVisibility = () => {
      if (document.hidden) {
        emit('tab_switch', 'Document became hidden', 'medium')
        showBanner('Please stay on this window during your interview.')

        blurTimeout = setTimeout(() => {
          if (document.hidden) {
            emit('tab_switch', 'Candidate away from window for >500ms', 'high')
          }
        }, 500)
      }
    }

    const handleBlur = () => {
      emit('window_blur', 'Window lost focus', 'low')
      showBanner('Please stay on this window during your interview.')

      blurTimeout = setTimeout(() => {
        if (!document.hasFocus()) {
          emit('tab_switch', 'Window unfocused for >500ms', 'high')
        }
      }, 500)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      clearTimeout(blurTimeout)
    }
  }, [enabled, emit, showBanner])

  // ── Copy-paste detection ──
  useEffect(() => {
    if (!enabled) return

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') ?? ''
      if (text.length > 10) {
        emit('copy_paste', `Pasted ${text.length} characters`, 'medium')
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [enabled, emit])

  if (!enabled) return null

  return (
    <>
      {/* Hidden video + canvas for analysis */}
      <video
        ref={videoRef}
        muted
        playsInline
        className="fixed top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Banner — visible only when triggered */}
      {bannerText && (
        <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-3 pointer-events-none">
          <div className="rounded-lg bg-neutral-800/90 px-4 py-2 text-sm text-white shadow-lg animate-[fade-in_200ms_ease-out]">
            {bannerText}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
