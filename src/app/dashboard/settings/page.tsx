'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { User, Mail, Building2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const supabase = createBrowserSupabaseClient()

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setEmail(user.email ?? '')

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (profile) {
      setFullName(profile.full_name ?? '')
      setRole(profile.role ?? 'hr')
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id)

    setSaving(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Profile updated')
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setPasswordLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setPasswordLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>

      {/* Profile section */}
      <Card>
        <form onSubmit={handleSaveProfile} className="space-y-5 p-6">
          <h2 className="text-lg font-medium text-neutral-900">Profile</h2>

          <Input
            label="Full name"
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leadingIcon={User}
          />

          <Input
            label="Email"
            value={email}
            disabled
            leadingIcon={Mail}
            hint="Email cannot be changed"
          />

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
              Role
            </label>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-500">
              <Shield className="h-4 w-4 text-neutral-400" />
              <span className="capitalize">{role}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Password section */}
      <Card>
        <form onSubmit={handleChangePassword} className="space-y-5 p-6">
          <h2 className="text-lg font-medium text-neutral-900">
            Change password
          </h2>

          <Input
            type="password"
            label="New password"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leadingIcon={Building2}
            required
            minLength={6}
          />

          <Input
            type="password"
            label="Confirm new password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leadingIcon={Building2}
            required
            minLength={6}
          />

          <div className="flex justify-end">
            <Button type="submit" loading={passwordLoading}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
