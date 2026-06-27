'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { getReminders } from '@/lib/api'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function Header({ title }: { title?: string }) {
  const { user, logout, toggleTheme, theme, setSidebarOpen, sidebarOpen, readNotifications, markNotificationRead, markAllNotificationsRead } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => getReminders().then(r => r.data),
    refetchInterval: 60000,
  })

  // Build notification items from reminders
  const notifications = [
    ...(reminders?.overdue || []).map((t: any) => ({ id: `overdue-${t._id}`, taskId: t._id, title: t.title, type: 'overdue', date: t.dueDate })),
    ...(reminders?.dueToday || []).map((t: any) => ({ id: `today-${t._id}`, taskId: t._id, title: t.title, type: 'today', date: t.dueDate })),
    ...(reminders?.upcoming || []).map((t: any) => ({ id: `upcoming-${t._id}`, taskId: t._id, title: t.title, type: 'upcoming', date: t.dueDate })),
  ]

  // Count unread
  const unreadCount = notifications.filter(n => !readNotifications.includes(n.id)).length

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleNotifClick = (notif: any) => {
    markNotificationRead(notif.id)
    setNotifOpen(false)
    // Navigate to my-tasks with taskId to auto-open the task detail
    router.push(`/dashboard/my-tasks?taskId=${notif.taskId}`)
  }

  const handleMarkAllRead = () => {
    markAllNotificationsRead(notifications.map(n => n.id))
  }

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
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="text-xl">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification dropdown */}
        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 card shadow-xl py-0 animate-fade-in z-50 max-h-[400px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <p className="text-center py-6 text-sm text-slate-400">No notifications 🎉</p>
              ) : (
                notifications.slice(0, 20).map(notif => {
                  const isRead = readNotifications.includes(notif.id)
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={clsx(
                        'w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors',
                        !isRead && 'bg-blue-50/50 dark:bg-blue-900/10'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm mt-0.5">
                          {notif.type === 'overdue' ? '🚨' : notif.type === 'today' ? '📅' : '🔜'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={clsx('text-sm truncate', !isRead ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {notif.type === 'overdue' ? 'Overdue' : notif.type === 'today' ? 'Due Today' : 'Upcoming'}
                            {notif.date && ` · ${format(new Date(notif.date), 'dd MMM')}`}
                          </p>
                        </div>
                        {!isRead && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            <Link
              href="/dashboard/reminders"
              onClick={() => setNotifOpen(false)}
              className="block text-center py-2.5 text-xs text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700"
            >
              View all reminders →
            </Link>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden">
            {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user?.name?.[0]?.toUpperCase()}
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
