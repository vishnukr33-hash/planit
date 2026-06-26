'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addComment } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function ChatPopup() {
  const { chatPopup, dismissChatPopup, markChatRead } = useAuthStore()
  const [reply, setReply] = useState('')
  const [minimized, setMinimized] = useState(false)
  const router = useRouter()
  const qc = useQueryClient()

  const replyMutation = useMutation({
    mutationFn: () => addComment(chatPopup!.taskId, reply),
    onSuccess: () => {
      setReply('')
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['chats'] })
      toast.success('Reply sent')
    },
    onError: () => toast.error('Failed to send'),
  })

  if (!chatPopup) return null

  const handleOpenTask = () => {
    markChatRead(chatPopup.taskId)
    dismissChatPopup()
    router.push(`/dashboard/my-tasks?taskId=${chatPopup.taskId}`)
  }

  const handleReply = () => {
    if (reply.trim()) {
      replyMutation.mutate()
    }
  }

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <span>💬</span>
          <span className="text-sm font-medium">New message from {chatPopup.senderName}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 animate-slide-in">
      <div className="card shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">💬 {chatPopup.senderName}</p>
            <p className="text-xs text-blue-200 truncate">{chatPopup.taskTitle}</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setMinimized(true)} className="p-1 hover:bg-blue-500 rounded text-xs">—</button>
            <button onClick={dismissChatPopup} className="p-1 hover:bg-blue-500 rounded text-xs">✕</button>
          </div>
        </div>

        {/* Message */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800">
          <div className="bg-white dark:bg-slate-700 rounded-xl px-3 py-2 shadow-sm">
            <p className="text-sm text-slate-800 dark:text-slate-100">{chatPopup.message}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              {new Date(chatPopup.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Reply */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Type a reply..."
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && reply.trim()) handleReply() }}
            />
            <button
              onClick={handleReply}
              disabled={!reply.trim() || replyMutation.isPending}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </div>
          <button
            onClick={handleOpenTask}
            className="w-full mt-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline text-center"
          >
            Open full task & chat →
          </button>
        </div>
      </div>
    </div>
  )
}
