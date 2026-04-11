'use client'

import { useReducer, useCallback } from 'react'
import { cn } from '@/lib/utils'
import CameraCheck from './CameraCheck'
import MicCheck from './MicCheck'
import NetworkCheck from './NetworkCheck'
import BrowserCheck from './BrowserCheck'
import ReadinessConfirm from './ReadinessConfirm'

export type CheckStatus = 'pending' | 'checking' | 'pass' | 'warn' | 'fail'

export interface CheckResult {
  status: CheckStatus
  detail: string
}

interface State {
  step: number
  results: {
    camera: CheckResult
    mic: CheckResult
    network: CheckResult
    browser: CheckResult
  }
}

type Action =
  | { type: 'NEXT_STEP' }
  | { type: 'SET_RESULT'; check: keyof State['results']; result: CheckResult }

const initialState: State = {
  step: 0,
  results: {
    camera: { status: 'pending', detail: '' },
    mic: { status: 'pending', detail: '' },
    network: { status: 'pending', detail: '' },
    browser: { status: 'pending', detail: '' },
  },
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NEXT_STEP':
      return { ...state, step: state.step + 1 }
    case 'SET_RESULT':
      return {
        ...state,
        results: { ...state.results, [action.check]: action.result },
      }
  }
}

const STEP_LABELS = ['Camera', 'Microphone', 'Network', 'Browser', 'Confirmation']

interface SystemCheckProps {
  onComplete: () => void
  token: string
}

export default function SystemCheck({ onComplete, token }: SystemCheckProps) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const handleCheckComplete = useCallback(
    (check: keyof State['results'], result: CheckResult) => {
      dispatch({ type: 'SET_RESULT', check, result })
    },
    []
  )

  const handleCameraComplete = useCallback((r: CheckResult) => handleCheckComplete('camera', r), [handleCheckComplete])
  const handleMicComplete = useCallback((r: CheckResult) => handleCheckComplete('mic', r), [handleCheckComplete])
  const handleNetworkComplete = useCallback((r: CheckResult) => handleCheckComplete('network', r), [handleCheckComplete])
  const handleBrowserComplete = useCallback((r: CheckResult) => handleCheckComplete('browser', r), [handleCheckComplete])

  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT_STEP' })
  }, [])

  return (
    <div className="mx-auto max-w-[560px]">
      {/* Progress dots */}
      <div className="mb-8 flex items-center justify-center gap-3">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'h-3 w-3 rounded-full transition-colors',
                i === state.step
                  ? 'bg-brand-500 ring-4 ring-brand-100'
                  : i < state.step
                    ? 'bg-neutral-400'
                    : 'border-2 border-neutral-300 bg-white'
              )}
            />
            <span className="text-[10px] text-neutral-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Step title */}
      <div className="mb-6 text-center">
        <div className="mb-2 text-3xl font-bold text-brand-500">{state.step + 1}</div>
        <h2 className="text-lg font-medium text-neutral-900">
          {STEP_LABELS[state.step]}
        </h2>
      </div>

      {/* Step content with fade */}
      <div
        className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-opacity duration-200"
        key={state.step}
      >
        {state.step === 0 && (
          <CameraCheck
            onCheckComplete={handleCameraComplete}
            onNext={handleNext}
          />
        )}
        {state.step === 1 && (
          <MicCheck
            onCheckComplete={handleMicComplete}
            onNext={handleNext}
          />
        )}
        {state.step === 2 && (
          <NetworkCheck
            onCheckComplete={handleNetworkComplete}
            onNext={handleNext}
          />
        )}
        {state.step === 3 && (
          <BrowserCheck
            onCheckComplete={handleBrowserComplete}
            onNext={handleNext}
          />
        )}
        {state.step === 4 && (
          <ReadinessConfirm
            results={state.results}
            token={token}
            onBegin={onComplete}
          />
        )}
      </div>
    </div>
  )
}
