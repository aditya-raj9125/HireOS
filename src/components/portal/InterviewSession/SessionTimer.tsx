'use client'

import { useEffect, useRef } from 'react'

interface SessionTimerProps {
  remainingSeconds: number
  totalSeconds: number
  phase: 'normal' | 'warning' | 'overtime'
}

export default function SessionTimer({ remainingSeconds, totalSeconds, phase }: SessionTimerProps) {
  const ariaRef = useRef<HTMLDivElement>(null)
  const prevPhaseRef = useRef(phase)

  // Announce phase changes
  useEffect(() => {
    if (phase !== prevPhaseRef.current && ariaRef.current) {
      if (phase === 'warning') {
        ariaRef.current.textContent = '5 minutes remaining.'
      } else if (phase === 'overtime') {
        ariaRef.current.textContent = "Time's up."
      }
      prevPhaseRef.current = phase
    }
  }, [phase])

  const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const dashoffset = circumference * (1 - fraction)

  const minutes = Math.floor(Math.max(0, remainingSeconds) / 60)
  const seconds = Math.max(0, remainingSeconds) % 60
  const timeText =
    phase === 'overtime' && remainingSeconds <= 0
      ? "Time's up"
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const arcColor =
    phase === 'normal' ? '#0F9B77' : phase === 'warning' ? '#F59E0B' : '#EF4444'

  const pulseClass =
    phase === 'warning'
      ? 'animate-[timer-pulse_1.5s_ease-in-out_infinite]'
      : phase === 'overtime'
        ? 'animate-[timer-pulse_0.8s_ease-in-out_infinite]'
        : ''

  return (
    <>
      {/* Desktop: circular timer */}
      <div
        className={`fixed top-4 right-4 z-50 hidden md:flex items-center justify-center ${pulseClass}`}
        style={{ width: 80, height: 80 }}
      >
        <svg
          width={80}
          height={80}
          viewBox="0 0 80 80"
          className="absolute inset-0"
        >
          {/* Track */}
          <circle
            cx={40}
            cy={40}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={4}
          />
          {/* Progress arc */}
          <circle
            cx={40}
            cy={40}
            r={radius}
            fill="none"
            stroke={arcColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 40 40)"
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span
          className="relative text-sm font-semibold"
          style={{ color: arcColor }}
        >
          {timeText}
        </span>
      </div>

      {/* Mobile: pill badge */}
      <div
        className={`fixed top-3 right-3 z-50 flex md:hidden items-center rounded-full px-3 py-1.5 shadow-md ${pulseClass}`}
        style={{ backgroundColor: arcColor + '18', border: `1.5px solid ${arcColor}` }}
      >
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: arcColor }}
        >
          {timeText}
        </span>
      </div>

      {/* Accessibility announcement */}
      <div ref={ariaRef} aria-live="assertive" className="sr-only" />

      {/* Keyframe injection */}
      <style>{`
        @keyframes timer-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}</style>
    </>
  )
}
