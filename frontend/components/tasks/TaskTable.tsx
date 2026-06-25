'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteTask } from '@/lib/api'
import { STATUS_COLORS, PRIORITY_COLORS, CATEGORY_COLORS } from '@/lib/constants'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import TaskModal from './TaskModal'
import TaskDetailModal from './TaskDetailModal'
import clsx from 'clsx'

interface Props {
  tasks: any[]
  showAssignee?: boolean
}

export default function TaskTable({ tasks, showAssignee }: Props) {
  const { user } = useAuthStore()
  const [editTask, setEditTask] = useState<any>(null)
  const [viewTask, setViewTask] = useState<any>(null)
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin'

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['trash-tasks'] })
      toast.success('Task deleted') 
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  })

  const isOverdue = (dueDate: string, status: string) =>
    status !== 'Done' && !!dueDate && new Date(dueDate) < new Date()

  if (!tasks.length) return (
    <div className="text-center py-12 text-slate-400 dark:text-slate-500">
      <p className="text-4xl mb-3">📋</p>
      <p>No tasks found</p>
    </div>
  )

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {['Task', 'Description', 'Status', 'Category', 'Priority', 'Due Date & Time',
                ...(showAssignee ? ['Assignee'] : []), 'Actions'].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {tasks.map(task => {
              const overdue = isOverdue(task.dueDate, task.status)
              const isAssignedToMe = task.assignedTo?._id === user?._id
              const isCreator = task.assignedBy?._id === user?._id
              const isDone = task.status === 'Done'
              const isLocked = task.lockedByDone && !isAdmin && !isCreator

              // Edit permission: admin, creator, or assignee (not locked, not done)
              const canEdit = isAdmin || isCreator || (!isLocked && !isDone && isAssignedToMe)
              // Delete permission: admin, or creator (head/teamlead who assigned it)
              const canDelete = isAdmin || (isCreator && user?.role !== 'user')

              return (
                <tr key={task._id} className={clsx(
                  'hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors',
                  overdue && 'bg-red-50/50 dark:bg-red-900/10'
                )}>
                  {/* Task title + last message */}
                  <td className="py-3 px-4 max-w-[200px]">
                    <button onClick={() => setViewTask(task)}
                      className={clsx('font-medium hover:underline text-left block',
                        isDone ? 'text-green-600 dark:text-green-400 line-through' :
                          overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'
                      )}>
                      {task.title}
                    </button>
                    {task.lockedByDone && <span className="text-xs text-slate-400">🔒</span>}
                    {/* Self Assigned sticker */}
                    {task.assignedBy?._id === task.assignedTo?._id && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Self Assigned</span>
                    )}
                    {/* Last chat message preview */}
                    {(() => {
                      const lastMsg = [...(task.comments || [])].reverse().find((c: any) => c.type === 'comment')
                      return lastMsg ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[180px]">
                          💬 {lastMsg.user?.name}: {lastMsg.text}
                        </p>
                      ) : null
                    })()}
                  </td>

                  {/* Description */}
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{task.description}</td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <span className={clsx('badge', STATUS_COLORS[task.status])}>{task.status}</span>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4">
                    <span className={clsx('badge', CATEGORY_COLORS[task.category] || 'bg-slate-100 text-slate-600')}>{task.category}</span>
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-4">
                    <span className={clsx('badge', PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                  </td>

                  {/* Due Date + Time */}
                  <td className={clsx('py-3 px-4 text-sm whitespace-nowrap',
                    overdue ? 'text-red-500 font-medium' : 'text-slate-500 dark:text-slate-400')}>
                    {task.dueDate
                      ? <>{format(new Date(task.dueDate), 'dd/MM/yyyy')}<br /><span className="text-xs opacity-75">{format(new Date(task.dueDate), 'hh:mm a')}</span></>
                      : '—'}
                    {overdue && <span className="ml-1">⚠</span>}
                  </td>

                  {showAssignee && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{task.assignedTo?.name || '—'}</td>
                  )}

                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      {/* View/chat */}
                      <button onClick={() => setViewTask(task)} title="View & Chat"
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors">💬</button>

                      {/* Edit — admin, creator, or assigned user (if not locked/done) */}
                      {canEdit && (
                        <button onClick={() => setEditTask(task)} title="Edit"
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors">✏️</button>
                      )}

                      {/* Delete — admin or task creator (head/teamlead) */}
                      {canDelete && (
                        <button onClick={() => { if (confirm('Delete this task?')) deleteMutation.mutate(task._id) }} title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editTask && <TaskModal task={editTask} onClose={() => setEditTask(null)} />}
      {viewTask && <TaskDetailModal task={viewTask} onClose={() => setViewTask(null)} onEdit={() => { setEditTask(viewTask); setViewTask(null) }} />}
    </>
  )
}
