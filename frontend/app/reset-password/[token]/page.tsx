'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { resetPassword } from '@/lib/api'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: () => { toast.success('Password reset! Please login.'); router.push('/login') },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 6) return toast.error('Min 6 characters')
    mutation.mutate()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-blue-900 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <Link href="/login" className="text-blue-600 text-sm hover:underline mb-6 block">← Back to login</Link>
        <h2 className="text-xl font-semibold mb-6">Set New Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
          </div>
          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
            {mutation.isPending ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
