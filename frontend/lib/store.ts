import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  _id: string
  name: string
  email: string
  username: string
  employeeCode: string
  role: 'admin' | 'user'
  status: string
  phone?: string
}

interface AuthStore {
  token: string | null
  user: User | null
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      theme: 'light',
      sidebarOpen: true,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    { name: 'auth-store', partialize: (s) => ({ token: s.token, user: s.user, theme: s.theme }) }
  )
)
