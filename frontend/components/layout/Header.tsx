'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { getReminders } from '@/lib/api'

export default function Header({ title }: { title?: string }) {
  const { user, logout, toggleTheme, theme, setSidebarOpen, sidebarOpen } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const router = useRouter()

  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => getReminders().then(r => r.data),
    refetchInterval: 60000,
  })

  const overdueCount = (reminders?.overdue?.length || 0) + (reminders?.dueToday?.length || 0)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-4">
      {/* Hamburger */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
        <div className="w-5 h-0.5 bg-slate-600 dark:bg-slate-300 mb-1" />
        <div className="w-5 h-0.5 bg-slate-600 dark:bg-slate-300 mb-1" />
        <div className="w-5 h-0.5 bg-slate-600 dark:bg-slate-300" />
      </button>

      {title && <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 hidden sm:block">{title}</h1>}

      <div className="flex-1" />

      {/* Theme toggle */}
      <button onClick={toggleTheme}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Notifications */}
      <Link href="/dashboard/reminders" className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
        <span className="text-xl">🔔</span>
        {overdueCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {overdueCount > 9 ? '9+' : overdueCount}
          </span>
        )}
      </Link>

      {/* Profile */}
      <div className="relative">
        <button onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-none">{user?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</p>
          </div>
          <span className="text-slate-400 text-xs">▾</span>
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 card shadow-lg py-1 animate-fade-in z-50">
            <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
              Hi {user?.name}!
            </p>
            <Link href="/dashboard/change-password"
              onClick={() => setProfileOpen(false)}
              className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              Change Password
            </Link>
            <button onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
