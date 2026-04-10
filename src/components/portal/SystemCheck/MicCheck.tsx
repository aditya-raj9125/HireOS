'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Mic, CheckCircle2, AlertTriangle, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckResult, CheckStatus } from './index'

interface MicCheckProps {
  onCheckComplete: (result: CheckResult) => void
  onNext: () => void
}

export default function MicCheck({ onCheckComplete, onNext }: MicCheckProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animRef = useRef<number>(0)
  const [noiseStatus, setNoiseStatus] = useState<CheckStatus>('checking')
  const [speechStatus, setSpeechStatus] = useState<CheckStatus>('pending')
  const [speakerConfirmed, setSpeakerConfirmed] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    let cancelled = false
    let audioCtx: AudioContext | null = null

    async function startMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser

        // Noise floor measurement for 2 seconds
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let noiseFrames = 0
        let noiseSum = 0

        const measureNoise = () => {
          analyser.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          noiseSum += avg
          noiseFrames++

          if (noiseFrames < 60) {
            // ~2 sec at 30fps
            requestAnimationFrame(measureNoise)
          } else {
            const avgNoise = noiseSum / noiseFrames
            // Approximate: avg byte > 40 ≈ -30dBFS threshold
            const status: CheckStatus = avgNoise > 40 ? 'warn' : 'pass'
            if (!cancelled) setNoiseStatus(status)
          }
        }
        measureNoise()

        // Waveform visualization
        const drawWaveform = () => {
          if (cancelled || !canvasRef.current) return
          const ctx = canvasRef.current.getContext('2d')
          if (!ctx) return
          const w = canvasRef.current.width
          const h = canvasRef.current.height

          analyser.getByteFrequencyData(dataArray)
          ctx.clearRect(0, 0, w, h)

          const barW = 4
          const gap = 2
          const bars = Math.floor(w / (barW + gap))

          for (let i = 0; i < bars; i++) {
            const idx = Math.floor((i / bars) * dataArray.length)
            const barH = (dataArray[idx] / 255) * h
            ctx.fillStyle = '#0F9B77'
            ctx.fillRect(i * (barW + gap), h - barH, barW, barH)
          }

          animRef.current = requestAnimationFrame(drawWaveform)
        }
        drawWaveform()
      } catch {
        if (!cancelled) {
          setNoiseStatus('fail')
          onCheckComplete({ status: 'fail', detail: 'Microphone permission denied' })
        }
      }
    }

    startMic()

    return () => {
      cancelled = true
      cancelAnimationFrame(animRef.current)
      audioCtx?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startSpeechTest = useCallback(() => {
    setListening(true)
    setSpeechStatus('checking')
    const analyser = analyserRef.current
    if (!analyser) {
      setSpeechStatus('fail')
      return
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    let detected = false
    const start = Date.now()

    const check = () => {
      if (detected) return
      if (Date.now() - start > 5000) {
        setSpeechStatus('fail')
        setListening(false)
        return
      }
      analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      if (avg > 30) {
        detected = true
        setSpeechStatus('pass')
        setListening(false)
        return
      }
      requestAnimationFrame(check)
    }
    check()
  }, [])

  const playTestTone = useCallback(() => {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 440
    gain.gain.value = 0.3
    osc.start()
    setTimeout(() => {
      osc.stop()
      ctx.close()
    }, 1000)
  }, [])

  // Compute overall
  useEffect(() => {
    if (
      noiseStatus !== 'checking' &&
      noiseStatus !== 'pending' &&
      speechStatus !== 'checking' &&
      speechStatus !== 'pending' &&
      speakerConfirmed !== null
    ) {
      const statuses = [noiseStatus, speechStatus, speakerConfirmed ? 'pass' : 'warn']
      const hasFail = statuses.includes('fail')
      const hasWarn = statuses.includes('warn')
      onCheckComplete({
        status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
        detail: hasFail ? 'Microphone check failed' : hasWarn ? 'Mic check passed with warnings' : 'Mic check passed',
      })
    }
  }, [noiseStatus, speechStatus, speakerConfirmed, onCheckComplete])

  return (
    <div className="space-y-4">
      {/* Waveform */}
      <div className="flex items-center justify-center rounded-xl bg-neutral-900 p-4">
        <canvas ref={canvasRef} width={400} height={80} className="w-full" />
      </div>

      {/* Noise check */}
      <div className="flex items-center gap-3 text-sm">
        <StatusBadge status={noiseStatus} />
        <span className="text-neutral-700">Noise Floor</span>
        <span className="flex-1 text-right text-neutral-500">
          {noiseStatus === 'checking'
            ? 'Measuring...'
            : noiseStatus === 'pass'
              ? 'Quiet environment'
              : 'Background noise detected'}
        </span>
      </div>

      {/* Speech test */}
      <div className="flex items-center gap-3 text-sm">
        <StatusBadge status={speechStatus} />
        <span className="text-neutral-700">Speech Detection</span>
        {speechStatus === 'pending' && (
          <button
            onClick={startSpeechTest}
            className="ml-auto rounded bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-200"
          >
            Say &quot;Hello&quot;
          </button>
        )}
        {speechStatus === 'checking' && listening && (
          <span className="ml-auto text-xs text-brand-600 animate-pulse">Listening...</span>
        )}
        {speechStatus === 'pass' && (
          <span className="ml-auto text-xs text-green-600">Detected!</span>
        )}
        {speechStatus === 'fail' && (
          <span className="ml-auto text-xs text-red-600">Not detected — try again</span>
        )}
      </div>

      {/* Speaker test */}
      <div className="flex items-center gap-3 text-sm">
        <Volume2 className="h-5 w-5 text-neutral-400" />
        <span className="text-neutral-700">Speaker Test</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={playTestTone}
            className="rounded bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
          >
            Play Tone
          </button>
          {speakerConfirmed === null && (
            <div className="flex gap-1">
              <button
                onClick={() => setSpeakerConfirmed(true)}
                className="rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
              >
                Yes
              </button>
              <button
                onClick={() => setSpeakerConfirmed(false)}
                className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
              >
                No
              </button>
            </div>
          )}
          {speakerConfirmed !== null && (
            <span className={cn('text-xs', speakerConfirmed ? 'text-green-600' : 'text-amber-600')}>
              {speakerConfirmed ? 'Confirmed' : 'Not heard'}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onNext}
        className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:bg-neutral-300"
      >
        Continue
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === 'warn') return <AlertTriangle className="h-5 w-5 text-amber-500" />
  if (status === 'fail') return <Mic className="h-5 w-5 text-red-500" />
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500" />
}
