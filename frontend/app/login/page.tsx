'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { login } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const { setAuth, token, theme } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    if (token) router.push('/dashboard')
  }, [token, theme, router])

  const mutation = useMutation({
    mutationFn: () => login(form),
    onSuccess: ({ data }) => {
      setAuth(data.token, data.user)
      toast.success(`Welcome back, ${data.user.name}!`)
      router.push('/dashboard')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Login failed'),
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="16" fill="#1e3a5f"/>
              <circle cx="32" cy="28" r="14" stroke="#3b82f6" strokeWidth="3" fill="none"/>
              <path d="M32 16v12l5 5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M24 26l6 6 10-10" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 26h6M12 34h7M12 42h5" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="48" cy="18" r="5" fill="#10b981"/>
              <path d="M46 18l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white"><span style={{color:'#93c5fd'}}>TVS</span> <span style={{color:'#4ade80'}}>DOT</span></h1>
          <p className="text-blue-200 mt-1">— No More FOMO —</p>
        </div>

        <div className="card p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-6">Sign in to your account</h2>

          <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
            <div>
              <label className="label">Username or Email</label>
              <input className="input" type="text" placeholder="Enter username or email"
                value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoFocus />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={showPass ? 'text' : 'password'} placeholder="Enter password"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</Link>
            </div>

            <button type="submit" disabled={mutation.isPending || !form.username || !form.password}
              className="btn-primary w-full py-2.5 text-base">
              {mutation.isPending ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
