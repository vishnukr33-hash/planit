'use client'
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { changePassword, updateProfile, getEmailSettings, updateEmailSettings } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function ChangePasswordPage() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [show, setShow] = useState({ current: false, new: false, confirm: false })
  const [phone, setPhone] = useState(user?.phone || '')
  const isAdmin = user?.role === 'admin'

  // Email settings (admin only)
  const [emailForm, setEmailForm] = useState({ host: 'smtp.gmail.com', port: '587', user: '', pass: '' })
  const { data: emailData } = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => getEmailSettings().then(r => r.data),
    enabled: isAdmin,
  })
  useEffect(() => {
    if (emailData) {
      setEmailForm({ host: emailData.host || 'smtp.gmail.com', port: String(emailData.port || 587), user: emailData.user || '', pass: '' })
    }
  }, [emailData])

  const passwordMutation = useMutation({
    mutationFn: () => changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    onSuccess: () => {
      toast.success('Password changed successfully')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error changing password'),
  })

  const phoneMutation = useMutation({
    mutationFn: () => updateProfile({ phone }),
    onSuccess: (res) => {
      toast.success('Phone number updated')
      setUser({ ...user!, phone: res.data.phone })
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error updating phone'),
  })

  const emailSettingsMutation = useMutation({
    mutationFn: () => updateEmailSettings({ host: emailForm.host, port: Number(emailForm.port), user: emailForm.user, pass: emailForm.pass }),
    onSuccess: () => toast.success('Email settings saved'),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error saving email settings'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match')
    if (form.newPassword.length < 6) return toast.error('Password must be at least 6 characters')
    passwordMutation.mutate()
  }

  return (
    <DashboardLayout title="My Profile">
      <div className="max-w-md mx-auto space-y-5">

        {/* Profile Image */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-xl">🖼️</div>
            <div>
              <h2 className="font-semibold">Profile Picture</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Visible in chat, comments, and headers</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden flex-shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]?.toUpperCase()
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <label className="label text-xs">Image URL (paste a link)</label>
                <input
                  className="input text-sm"
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  defaultValue={user?.avatar || ''}
                  onBlur={e => {
                    const val = e.target.value.trim()
                    if (val !== (user?.avatar || '')) {
                      updateProfile({ avatar: val }).then(res => {
                        setUser({ ...user!, avatar: res.data.avatar })
                        toast.success('Profile picture updated')
                      }).catch(() => toast.error('Failed to update'))
                    }
                  }}
                />
              </div>
              {user?.avatar && (
                <button
                  onClick={() => {
                    updateProfile({ avatar: '' }).then(res => {
                      setUser({ ...user!, avatar: '' })
                      toast.success('Profile picture removed')
                    }).catch(() => toast.error('Failed to remove'))
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove picture
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Phone / WhatsApp */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-xl">📱</div>
            <div>
              <h2 className="font-semibold">WhatsApp Number</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Used for task & reminder notifications</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">
                Phone Number{' '}
                <span className="text-slate-400 font-normal text-xs">(with country code, e.g. 919876543210)</span>
              </label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="919876543210"
              />
            </div>
            <button
              onClick={() => phoneMutation.mutate()}
              disabled={phoneMutation.isPending || phone === (user?.phone || '')}
              className="btn-primary w-full py-2.5"
            >
              {phoneMutation.isPending ? 'Saving...' : 'Save Phone Number'}
            </button>
          </div>
        </div>

        {/* Email Settings — Admin only */}
        {isAdmin && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-xl">📧</div>
              <div>
                <h2 className="font-semibold">Email Settings (SMTP)</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Configure for task notification emails</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">SMTP Host</label>
                  <input className="input text-sm" value={emailForm.host} onChange={e => setEmailForm(f => ({ ...f, host: e.target.value }))} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input className="input text-sm" value={emailForm.port} onChange={e => setEmailForm(f => ({ ...f, port: e.target.value }))} placeholder="587" />
                </div>
              </div>
              <div>
                <label className="label">Email / Username</label>
                <input className="input text-sm" type="email" value={emailForm.user} onChange={e => setEmailForm(f => ({ ...f, user: e.target.value }))} placeholder="your-email@gmail.com" />
              </div>
              <div>
                <label className="label">App Password <span className="text-slate-400 font-normal text-xs">(Gmail: use App Password, not regular password)</span></label>
                <input className="input text-sm" type="password" value={emailForm.pass} onChange={e => setEmailForm(f => ({ ...f, pass: e.target.value }))} placeholder="Enter app password" />
              </div>
              <button onClick={() => emailSettingsMutation.mutate()} disabled={emailSettingsMutation.isPending || !emailForm.user}
                className="btn-primary w-full py-2.5">
                {emailSettingsMutation.isPending ? 'Saving...' : 'Save Email Settings'}
              </button>
            </div>
          </div>
        )}

        {/* Change Password */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-xl">🔒</div>
            <div>
              <h2 className="font-semibold">Change Password</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Update your account password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'currentPassword', label: 'Current Password', showKey: 'current' as const },
              { key: 'newPassword', label: 'New Password', showKey: 'new' as const },
              { key: 'confirmPassword', label: 'Confirm New Password', showKey: 'confirm' as const },
            ].map(({ key, label, showKey }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={show[showKey] ? 'text' : 'password'}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {show[showKey] ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <button type="submit" disabled={passwordMutation.isPending} className="btn-primary w-full py-2.5">
                {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </DashboardLayout>
  )
}
