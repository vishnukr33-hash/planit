// v3
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { getChats } from '@/lib/api'
import clsx from 'clsx'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/dashboard/my-tasks', label: 'My Tasks', icon: '✓' },
  { href: '/dashboard/team-tasks', label: 'Team Tasks', icon: '👥' },
  { href: '/dashboard/chats', label: 'Chats', icon: '💬' },
  { href: '/dashboard/reminders', label: 'Reminders', icon: '🔔' },
  { href: '/dashboard/deleted', label: 'Deleted', icon: '🗑️' },
  { href: '/dashboard/users', label: 'Add User', icon: '➕', roles: ['admin', 'head', 'teamlead'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, sidebarOpen, setSidebarOpen, readNotifications } = useAuthStore()

  // Fetch chats to get unread count
  const { data: chatsData } = useQuery({
    queryKey: ['chats'],
    queryFn: () => getChats().then(r => r.data),
    refetchInterval: 30000,
  })

  // Count tasks with unread chats
  const unreadChatCount = (chatsData?.tasks || []).filter((task: any) => {
    if (readNotifications.includes(`chat-${task._id}`)) return false
    const comments = (task.comments || []).filter((c: any) => c.type === 'comment')
    return comments.some((c: any) => c.user?._id !== user?._id)
  }).length

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={clsx(
        'fixed top-0 left-0 h-full z-30 flex flex-col transition-all duration-300',
        'bg-brand-800 dark:bg-slate-900 text-white',
        sidebarOpen ? 'w-64' : 'w-16',
        'lg:relative lg:translate-x-0',
        !sidebarOpen && '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#1e3a5f"/>
              <path d="M8 10h12M8 16h16M8 22h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="22" cy="22" r="6" fill="#166534"/>
              <path d="M19.5 22l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {sidebarOpen && <span className="font-bold text-lg tracking-tight"><span className="text-blue-200">Plan</span><span className="text-green-400">it</span></span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.filter(item => !item.roles || item.roles.includes(user?.role || '')).map(item => (
            <Link key={item.href} href={item.href}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-colors text-sm font-medium relative',
                pathname === item.href
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )}>
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
              {item.href === '/dashboard/chats' && unreadChatCount > 0 && (
                <span className="absolute top-2 right-3 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User info */}
        {sidebarOpen && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
