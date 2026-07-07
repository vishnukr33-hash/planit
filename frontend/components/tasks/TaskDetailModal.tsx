'use client'
import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addComment, updateTask, completeTask } from '@/lib/api'
import { STATUS_COLORS, PRIORITY_COLORS, CATEGORY_COLORS } from '@/lib/constants'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function TaskDetailModal({ task, onClose, onEdit }: { task: any; onClose: () => void; onEdit: () => void }) {
  const { user, markChatRead } = useAuthStore()
  const [comment, setComment] = useState('')
  const [localTask, setLocalTask] = useState(task)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const isAssigned = localTask.assignedTo?._id === user?._id ||
    String(localTask.assignedTo?._id) === String(user?._id)
  const isCreator = localTask.assignedBy?._id === user?._id ||
    String(localTask.assignedBy?._id) === String(user?._id)
  const isLocked = localTask.lockedByDone && !isAdmin && !isCreator

  // Edit permission: admin, creator, or assignee (not locked)
  const canEdit = isAdmin || isCreator || (isAssigned && !isLocked)

  // Status options
  const availableStatuses = isAdmin || isCreator
    ? ['Pending', 'In Progress', 'Need Discussion', 'Done', 'Delayed']
    : ['In Progress', 'Need Discussion', 'Done', 'Delayed']

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localTask.comments])

  // Mark chat as read when modal opens
  useEffect(() => {
    if (localTask._id) {
      markChatRead(localTask._id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTask._id])

  const refresh = (updated: any) => {
    setLocalTask(updated)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    qc.invalidateQueries({ queryKey: ['team-productivity'] })
  }

  const commentMutation = useMutation({
    mutationFn: () => addComment(localTask._id, comment),
    onSuccess: (res) => { refresh(res.data); setComment(''); toast.success('Message sent') },
    onError: () => toast.error('Failed to send'),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateTask(localTask._id, { status }),
    onSuccess: (res) => { refresh(res.data); toast.success('Status updated') },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  })

  const doneMutation = useMutation({
    mutationFn: () => completeTask(localTask._id),
    onSuccess: (res) => { refresh(res.data); toast.success('Task marked as Done') },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="card w-full max-w-2xl flex flex-col max-h-[92vh] animate-slide-in">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={clsx('badge', STATUS_COLORS[localTask.status])}>{localTask.status}</span>
              <span className={clsx('badge', PRIORITY_COLORS[localTask.priority])}>{localTask.priority}</span>
              <span className={clsx('badge', CATEGORY_COLORS[localTask.category] || 'bg-slate-100 text-slate-600')}>{localTask.category}</span>
              {localTask.lockedByDone && <span className="badge bg-slate-100 text-slate-500 text-xs">🔒 Locked</span>}
              {localTask.isShared && <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">👥 Shared</span>}
            </div>
            <h2 className="text-base font-semibold truncate">{localTask.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Assigned to <strong>{localTask.assignedTo?.name}</strong>
              {localTask.assignedBy?.name && <> · By <strong>{localTask.assignedBy.name}</strong></>}
              {localTask.dueDate && <> · Due <strong className={new Date(localTask.dueDate) < new Date() && localTask.status !== 'Done' ? 'text-red-500' : ''}>
                {format(new Date(localTask.dueDate), 'dd MMM yyyy, hh:mm a')}
              </strong></>}
            </p>
            {localTask.isShared && localTask.sharedWith?.length > 0 && (
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                👥 Shared with: {localTask.sharedWith.map((u: any) => u.name || u).join(', ')}
              </p>
            )}
          </div>
          <div className="flex gap-2 ml-3 flex-shrink-0">
            {canEdit && <button onClick={onEdit} className="btn-secondary text-sm py-1.5 px-3">Edit</button>}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/40 flex-shrink-0">
          {/* Status dropdown — admin/creator always, team member if not locked */}
          {(isAdmin || isCreator || (isAssigned && !isLocked)) && localTask.status !== 'Done' && (
            <select
              className="input text-sm py-1.5 max-w-[180px]"
              value={localTask.status}
              onChange={e => statusMutation.mutate(e.target.value)}
              disabled={statusMutation.isPending}
            >
              {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* Mark Done button for assigned user */}
          {isAssigned && localTask.status !== 'Done' && !isLocked && (
            <button onClick={() => doneMutation.mutate()} disabled={doneMutation.isPending}
              className="btn-primary text-sm py-1.5 px-4 bg-green-600 hover:bg-green-700">
              🏁 Mark Done
            </button>
          )}
        </div>

        {/* Description */}
        {localTask.description && (
          <div className="px-5 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Description</p>
            <p className="text-sm">{localTask.description}</p>
          </div>
        )}

        {/* Chat / Comments */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {localTask.comments?.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-4">No messages yet. Start the conversation!</p>
          )}
          {localTask.comments?.map((c: any) => {
            const isMine = c.user?._id === user?._id || c.user?.username === user?.username
            const isStatusMsg = c.type === 'status_update'

            if (isStatusMsg) {
              return (
                <div key={c._id} className="flex justify-center">
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-3 py-1">
                    🔄 {c.user?.name} · {c.text} · {format(new Date(c.createdAt), 'dd MMM, hh:mm a')}
                  </span>
                </div>
              )
            }

            return (
              <div key={c._id} className={clsx('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                  isMine
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                )}>
                  {!isMine && (
                    <p className="text-xs font-semibold mb-1 text-blue-500 dark:text-blue-400">{c.user?.name}</p>
                  )}
                  <p className="text-sm leading-relaxed">{c.text}</p>
                  <p className={clsx('text-xs mt-1', isMine ? 'text-blue-200' : 'text-slate-400')}>
                    {format(new Date(c.createdAt), 'hh:mm a · dd MMM')}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="flex gap-2 p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <input
            className="input flex-1 text-sm"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && comment.trim()) { e.preventDefault(); commentMutation.mutate() } }}
          />
          <button
            onClick={() => comment.trim() && commentMutation.mutate()}
            disabled={!comment.trim() || commentMutation.isPending}
            className="btn-primary text-sm py-2 px-4"
          >
            Send
          </button>
        </div>

      </div>
    </div>
  )
}
