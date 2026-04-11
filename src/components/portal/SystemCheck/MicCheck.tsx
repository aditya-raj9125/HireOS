'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Mic, CheckCircle2, AlertTriangle, XCircle, Volume2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckResult, CheckStatus } from './index'

interface MicCheckProps {
  onCheckComplete: (result: CheckResult) => void
  onNext: () => void
}

type Phase = 'requesting' | 'active' | 'denied' | 'error'

export default function MicCheck({ onCheckComplete, onNext }: MicCheckProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<Phase>('requesting')
  const [errorMsg, setErrorMsg] = useState('')
  const [noiseStatus, setNoiseStatus] = useState<CheckStatus>('checking')
  const [speechStatus, setSpeechStatus] = useState<CheckStatus>('pending')
  const [speakerConfirmed, setSpeakerConfirmed] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)

  const requestMic = useCallback(async () => {
    // Clean up prior resources
    cancelAnimationFrame(animRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    setPhase('requesting')
    setErrorMsg('')
    setNoiseStatus('checking')
    setSpeechStatus('pending')
    setSpeakerConfirmed(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      setPhase('active')

      // Measure noise floor
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let noiseFrames = 0
      let noiseSum = 0

      const measureNoise = () => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        noiseSum += avg
        noiseFrames++
        if (noiseFrames < 60) {
          requestAnimationFrame(measureNoise)
        } else {
          const avgNoise = noiseSum / noiseFrames
          setNoiseStatus(avgNoise > 40 ? 'warn' : 'pass')
        }
      }
      measureNoise()

      // Draw waveform
      const drawWaveform = () => {
        if (!canvasRef.current) return
        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })
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
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : ''
      const message = err instanceof Error ? err.message : String(err)

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPhase('denied')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPhase('error')
        setErrorMsg('No microphone found. Please connect a microphone and try again.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setPhase('error')
        setErrorMsg('Microphone is in use by another app. Close other apps and try again.')
      } else {
        setPhase('error')
        setErrorMsg(message || 'Unknown microphone error')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    requestMic()
    return () => {
      cancelAnimationFrame(animRef.current)
      audioCtxRef.current?.close()
      audioCtxRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [requestMic])

  const startSpeechTest = useCallback(async () => {
    setListening(true)
    setSpeechStatus('checking')
    const analyser = analyserRef.current
    const audioCtx = audioCtxRef.current
    if (!analyser || !audioCtx) {
      setSpeechStatus('fail')
      setListening(false)
      return
    }

    // Resume AudioContext — browsers may suspend it until a user gesture
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }

    // Use time-domain data: silence = 128, speech causes deviations above/below
    const dataArray = new Uint8Array(analyser.fftSize)
    let detected = false
    const start = Date.now()

    const check = () => {
      if (detected) return
      if (Date.now() - start > 7000) {
        setSpeechStatus('fail')
        setListening(false)
        return
      }
      analyser.getByteTimeDomainData(dataArray)
      const maxDeviation = dataArray.reduce((max, v) => Math.max(max, Math.abs(v - 128)), 0)
      if (maxDeviation > 25) {
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

  // Compute overall when all sub-checks done
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
        detail: hasFail ? 'Mic check failed' : hasWarn ? 'Mic check passed with warnings' : 'Mic check passed',
      })
    }
  }, [noiseStatus, speechStatus, speakerConfirmed, onCheckComplete])

  // Requesting state
  if (phase === 'requesting') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <Mic className="h-7 w-7 text-brand-500" />
        </div>
        <p className="font-medium text-neutral-900">Requesting microphone access...</p>
        <p className="text-sm text-neutral-500">
          If a browser prompt appears, click <strong>Allow</strong>.
        </p>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500" />
      </div>
    )
  }

  // Denied state
  if (phase === 'denied') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="font-semibold text-neutral-900">Microphone Access Denied</h3>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-left text-sm text-amber-800">
          <p className="mb-2 font-semibold">To allow microphone access:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Click the <strong>lock/info icon</strong> in the address bar</li>
            <li>Set <strong>Microphone</strong> to <strong>Allow</strong></li>
            <li>Then click <strong>&quot;Try Again&quot;</strong> below</li>
          </ol>
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={requestMic}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <button
            onClick={() => {
              onCheckComplete({ status: 'warn', detail: 'Microphone skipped by candidate' })
              onNext()
            }}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  // Error state
  if (phase === 'error') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
        </div>
        <h3 className="font-semibold text-neutral-900">Microphone Error</h3>
        <p className="text-sm text-neutral-600">{errorMsg}</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={requestMic}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <button
            onClick={() => {
              onCheckComplete({ status: 'warn', detail: 'Mic error: ' + errorMsg })
              onNext()
            }}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  // Active state - mic is working
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
          <span className="ml-auto text-xs text-red-600">Not detected - try again</span>
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
  if (status === 'fail') return <XCircle className="h-5 w-5 text-red-500" />
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500" />
}
