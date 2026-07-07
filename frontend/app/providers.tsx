'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/lib/store'
import ChatPopup from '@/components/ChatPopup'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60000,        // 1 minute — don't refetch if data is fresh
      refetchOnWindowFocus: false, // disable refetch on tab switch (reduces noise)
    }
  }
})

function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token, showChatPopup } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!user || !token) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
    const socketUrl = apiUrl.replace('/api', '')

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join', user._id)
    })

    // Auto-refresh on task events
    socket.on('task:new', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['team-productivity'] })
    })

    socket.on('task:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['team-productivity'] })
    })

    // Chat message received — show popup and refresh queries
    socket.on('task:comment', (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })

      // Show chat popup if the message is from someone else
      if (data && data.comment && data.comment.user?._id !== user._id) {
        showChatPopup({
          taskId: data.taskId,
          taskTitle: data.taskTitle || 'Task',
          senderName: data.comment.user?.name || 'Someone',
          message: data.comment.text || '',
          timestamp: data.comment.createdAt || new Date().toISOString(),
        })
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user, token, showChatPopup])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <QueryClientProvider client={queryClient}>
      {mounted && (
        <SocketProvider>
          {children}
          <ChatPopup />
        </SocketProvider>
      )}
      <Toaster position="top-right" toastOptions={{
        className: 'dark:bg-slate-800 dark:text-white',
        duration: 3000,
      }} />
    </QueryClientProvider>
  )
}
