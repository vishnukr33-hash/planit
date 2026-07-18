'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getChats, getTask } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import TaskDetailModal from '@/components/tasks/TaskDetailModal'
import TaskModal from '@/components/tasks/TaskModal'
import { useAuthStore } from '@/lib/store'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function ChatsPage() {
  const { user, chatLastRead, markChatRead } = useAuthStore()
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [editTask, setEditTask] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: () => getChats().then(r => r.data),
    refetchInterval: 30000,
  })

  const handleOpenChat = async (task: any) => {
    // Show immediately with cached data
    setSelectedTask(task)
    markChatRead(task._id)
    // Refresh in background
    getTask(task._id).then(res => {
      setSelectedTask(res.data)
    }).catch(() => {})
  }

  // Count unread messages per task based on last-read timestamp
  const getUnreadCount = (task: any) => {
    const comments = (task.comments || []).filter((c: any) => c.type === 'comment' && c.user?._id !== user?._id)
    const lastReadTime = chatLastRead[task._id]
    if (!lastReadTime) {
      // Never read — all messages from others are unread
      return comments.length
    }
    const lastReadDate = new Date(lastReadTime)
    return comments.filter((c: any) => new Date(c.createdAt) > lastReadDate).length
  }

  if (isLoading) return (
    <DashboardLayout title="Chats">
      <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
    </DashboardLayout>
  )

  const tasks = data?.tasks || []

  return (
    <DashboardLayout title="Chats">
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-slate-400">No chats yet. Start a conversation on any task!</p>
          </div>
        ) : (
          <div className="card overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
            {tasks.map((task: any) => {
              const lastComment = [...(task.comments || [])].reverse().find((c: any) => c.type === 'comment')
              const unread = getUnreadCount(task)

              return (
                <button
                  key={task._id}
                  onClick={() => handleOpenChat(task)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                    {(() => {
                      const otherUser = task.assignedTo?._id === user?._id ? task.assignedBy : task.assignedTo
                      return otherUser?.avatar
                        ? <img src={otherUser.avatar} alt="" className="w-full h-full object-cover" />
                        : (otherUser?.name?.[0] || '?')
                    })()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={clsx('text-sm font-medium truncate', unread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300')}>
                        {task.title}
                      </p>
                      {task.isRecurring && <span className="text-[10px] text-blue-500">🔄</span>}
                    </div>
                    {lastComment && (
                      <p className={clsx('text-xs truncate mt-0.5', unread ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400')}>
                        {lastComment.user?.name}: {lastComment.text}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {task.assignedTo?._id === user?._id ? `From: ${task.assignedBy?.name}` : `To: ${task.assignedTo?.name}`}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {lastComment && (
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(lastComment.createdAt), 'dd MMM')}
                      </span>
                    )}
                    {unread > 0 && (
                      <span className="w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unread}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{(task.comments || []).filter((c: any) => c.type === 'comment').length} msgs</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={() => { setEditTask(selectedTask); setSelectedTask(null) }}
        />
      )}
      {editTask && <TaskModal task={editTask} onClose={() => setEditTask(null)} />}
    </DashboardLayout>
  )
}
