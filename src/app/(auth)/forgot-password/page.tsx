'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Mail, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createBrowserSupabaseClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="w-full max-w-[400px] rounded-2xl border border-neutral-200 bg-white p-8 shadow-card">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <Mail className="h-7 w-7 text-brand-500" />
          </div>
          <h2 className="text-xl font-medium text-neutral-900">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            We sent a password reset link to{' '}
            <span className="font-medium text-neutral-700">{email}</span>
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            Click the link in the email to reset your password.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-6 text-sm text-brand-500 hover:text-brand-600"
          >
            Try a different email
          </button>
          <Link
            href="/login"
            className="mt-3 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-neutral-200 bg-white p-8 shadow-card">
      <h2 className="text-center text-2xl font-medium text-neutral-900">
        Forgot password?
      </h2>
      <p className="mt-1 text-center text-sm text-neutral-500">
        Enter your email and we&apos;ll send you a reset link
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          type="email"
          label="Email address"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leadingIcon={Mail}
          required
          autoFocus
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center">
        <Link
          href="/login"
          className="flex items-center justify-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
