import axios from 'axios'

const API_BASE = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api')
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api')

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('auth-store')
    if (stored) {
      const { state } = JSON.parse(stored)
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth-store')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// Auth
export const login = (data: { username: string; password: string }) => api.post('/auth/login', data)
export const getMe = () => api.get('/auth/me')
export const changePassword = (data: object) => api.put('/auth/change-password', data)
export const updateProfile = (data: object) => api.put('/auth/profile', data)
export const getEmailSettings = () => api.get('/auth/email-settings')
export const updateEmailSettings = (data: object) => api.put('/auth/email-settings', data)
export const forgotPassword = (email: string) => api.post('/auth/forgot-password', { email })
export const resetPassword = (token: string, password: string) => api.post(`/auth/reset-password/${token}`, { password })

// Users
export const getUsers = (params?: object) => api.get('/users', { params })
export const getSubordinates = () => api.get('/users/subordinates')
export const createUser = (data: object) => api.post('/users', data)
export const updateUser = (id: string, data: object) => api.put(`/users/${id}`, data)
export const toggleUserStatus = (id: string) => api.patch(`/users/${id}/status`)
export const resetUserPassword = (id: string, password: string) => api.patch(`/users/${id}/reset-password`, { password })
export const deleteUser = (id: string) => api.delete(`/users/${id}`)

// Tasks
export const getTasks = (params?: object) => api.get('/tasks', { params })
export const getTask = (id: string) => api.get(`/tasks/${id}`)
export const createTask = (data: object) => api.post('/tasks', data)
export const updateTask = (id: string, data: object) => api.put(`/tasks/${id}`, data)
export const deleteTask = (id: string) => api.delete(`/tasks/${id}`)
export const getTrashTasks = () => api.get('/tasks/trash/list')
export const restoreTask = (id: string) => api.patch(`/tasks/${id}/restore`)
export const permanentDeleteTask = (id: string) => api.delete(`/tasks/${id}/permanent`)
export const exportTasks = () => api.get('/tasks/export/excel', { responseType: 'blob' })
export const addComment = (id: string, text: string) => api.post(`/tasks/${id}/comments`, { text })
export const completeTask = (id: string) => api.patch(`/tasks/${id}/complete`)
export const acceptTask = (id: string) => api.patch(`/tasks/${id}/accept`)

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats')

// Reminders
export const getReminders = () => api.get('/reminders')
