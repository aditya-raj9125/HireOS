'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    // Verify user has a valid recovery session
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (!data.session) {
        toast.error('Invalid or expired reset link. Please request a new one.')
        router.replace('/forgot-password')
      }
    })
  }, [router, supabase.auth])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Password updated successfully!')
    router.replace('/dashboard')
  }

  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-neutral-200 bg-white p-8 shadow-card">
      <h2 className="text-center text-2xl font-medium text-neutral-900">
        Reset password
      </h2>
      <p className="mt-1 text-center text-sm text-neutral-500">
        Enter your new password below
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            label="New password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leadingIcon={Lock}
            required
            minLength={6}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[38px] text-neutral-400 hover:text-neutral-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Input
          type={showPassword ? 'text' : 'password'}
          label="Confirm password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leadingIcon={Lock}
          required
          minLength={6}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Update password
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
