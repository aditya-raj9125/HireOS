'use client'

import { useState } from 'react'

interface LanguageToggleProps {
  onLanguageSwitch: (language: string) => void
}

export function LanguageToggle({ onLanguageSwitch }: LanguageToggleProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [switched, setSwitched] = useState(false)

  if (switched) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">
        <span>🗣️</span>
        <span>Hindi mode active — AI continues in English</span>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span>🗣️</span>
        <span>Switch to Hindi / हिंदी में जवाब दें</span>
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Switch to Hindi?</h3>
            <p className="text-sm text-gray-600 mb-4">
              You can respond in Hindi for the rest of this interview. The AI will continue asking
              questions in English. Confirm?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  setSwitched(true)
                  onLanguageSwitch('hi')
                }}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
