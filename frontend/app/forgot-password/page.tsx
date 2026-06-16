'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { forgotPassword } from '@/lib/api'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email),
    onSuccess: () => { setSent(true); toast.success('Reset email sent') },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-blue-900 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <Link href="/login" className="text-blue-600 text-sm hover:underline mb-6 block">← Back to login</Link>
        <h2 className="text-xl font-semibold mb-2">Forgot Password</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Enter your email to receive a reset link.</p>

        {sent ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">📧</p>
            <p className="font-medium">Check your email</p>
            <p className="text-sm text-slate-500 mt-1">Reset link sent to {email}</p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            </div>
            <button type="submit" disabled={mutation.isPending || !email} className="btn-primary w-full">
              {mutation.isPending ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
