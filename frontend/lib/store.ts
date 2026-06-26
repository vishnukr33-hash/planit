import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  _id: string
  name: string
  email: string
  username: string
  employeeCode: string
  role: 'admin' | 'head' | 'teamlead' | 'user'
  status: string
  phone?: string
  avatar?: string
}

interface ChatPopupData {
  taskId: string
  taskTitle: string
  senderName: string
  message: string
  timestamp: string
}

interface AuthStore {
  token: string | null
  user: User | null
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  readNotifications: string[]
  chatLastRead: Record<string, string> // taskId -> ISO timestamp of last read
  chatPopup: ChatPopupData | null
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (ids: string[]) => void
  markChatRead: (taskId: string) => void
  showChatPopup: (data: ChatPopupData) => void
  dismissChatPopup: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      theme: 'light',
      sidebarOpen: true,
      readNotifications: [],
      chatLastRead: {},
      chatPopup: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      markNotificationRead: (id) => set((s) => ({
        readNotifications: s.readNotifications.includes(id) ? s.readNotifications : [...s.readNotifications, id]
      })),
      markAllNotificationsRead: (ids) => set((s) => ({
        readNotifications: Array.from(new Set([...s.readNotifications, ...ids]))
      })),
      markChatRead: (taskId) => set((s) => ({
        chatLastRead: { ...s.chatLastRead, [taskId]: new Date().toISOString() }
      })),
      showChatPopup: (data) => set({ chatPopup: data }),
      dismissChatPopup: () => set({ chatPopup: null }),
    }),
    {
      name: 'auth-store',
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        theme: s.theme,
        readNotifications: s.readNotifications,
        chatLastRead: s.chatLastRead,
      })
    }
  )
)
