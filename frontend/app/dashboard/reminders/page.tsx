'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReminders, getTask } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import TaskDetailModal from '@/components/tasks/TaskDetailModal'
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants'
import { format } from 'date-fns'
import clsx from 'clsx'

const TaskCard = ({ task, type, onClick }: { task: any; type: 'overdue' | 'today' | 'upcoming'; onClick: () => void }) => (
  <div
    onClick={onClick}
    className={clsx('p-4 rounded-xl border transition-colors cursor-pointer hover:shadow-md', {
      'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10 hover:border-red-300': type === 'overdue',
      'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10 hover:border-orange-300': type === 'today',
      'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10 hover:border-blue-300': type === 'upcoming',
    })}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
        {task.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{task.description}</p>}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={clsx('badge', STATUS_COLORS[task.status])}>{task.status}</span>
          <span className={clsx('badge', PRIORITY_COLORS[task.priority])}>{task.priority}</span>
          {task.assignedTo && <span className="text-xs text-slate-500">👤 {task.assignedTo.name}</span>}
        </div>
        {/* Last chat message preview */}
        {task.comments?.length > 0 && (() => {
          const lastComment = [...task.comments].reverse().find((c: any) => c.type === 'comment')
          return lastComment ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
              💬 {lastComment.user?.name}: {lastComment.text}
            </p>
          ) : null
        })()}
      </div>
      <div className="text-right flex-shrink-0">
        <p className={clsx('text-sm font-medium', {
          'text-red-600 dark:text-red-400': type === 'overdue',
          'text-orange-600 dark:text-orange-400': type === 'today',
          'text-blue-600 dark:text-blue-400': type === 'upcoming',
        })}>
          {task.dueDate ? format(new Date(task.dueDate), 'dd MMM yyyy') : '—'}
        </p>
        {type === 'overdue' && <p className="text-xs text-red-500 mt-0.5">Overdue ⚠️</p>}
        {type === 'today' && <p className="text-xs text-orange-500 mt-0.5">Due Today</p>}
        {task.comments?.length > 0 && (
          <p className="text-xs text-slate-400 mt-1">💬 {task.comments.length} messages</p>
        )}
      </div>
    </div>
  </div>
)

const Section = ({ title, tasks, type, icon, onTaskClick }: { title: string; tasks: any[]; type: any; icon: string; onTaskClick: (task: any) => void }) => (
  <div className="card p-5">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xl">{icon}</span>
      <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      <span className="ml-auto badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{tasks.length}</span>
    </div>
    {tasks.length > 0 ? (
      <div className="space-y-3">
        {tasks.map(t => <TaskCard key={t._id} task={t} type={type} onClick={() => onTaskClick(t)} />)}
      </div>
    ) : (
      <p className="text-sm text-slate-400 text-center py-4">No tasks here 🎉</p>
    )}
  </div>
)

export default function RemindersPage() {
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [editTask, setEditTask] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => getReminders().then(r => r.data),
    refetchInterval: 60000,
  })

  const handleTaskClick = async (task: any) => {
    try {
      // Fetch full task with comments populated
      const res = await getTask(task._id)
      setSelectedTask(res.data)
    } catch {
      // Fallback to the task data we already have
      setSelectedTask(task)
    }
  }

  if (isLoading) return (
    <DashboardLayout title="Reminders">
      <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout title="Reminders">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="Overdue Tasks" tasks={data?.overdue || []} type="overdue" icon="🚨" onTaskClick={handleTaskClick} />
        <Section title="Due Today" tasks={data?.dueToday || []} type="today" icon="📅" onTaskClick={handleTaskClick} />
        <Section title="Upcoming (7 days)" tasks={data?.upcoming || []} type="upcoming" icon="🔜" onTaskClick={handleTaskClick} />
      </div>

      {/* Recent Comments / Chat */}
      {data?.recentComments?.length > 0 && (
        <div className="card p-5 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💬</span>
            <h3 className="font-semibold">Recent Team Replies</h3>
          </div>
          <div className="space-y-3">
            {data.recentComments.map((task: any) => (
              <div
                key={task._id}
                onClick={() => handleTaskClick(task)}
                className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:shadow-sm transition-all"
              >
                <p className="font-medium text-sm mb-2">{task.title}</p>
                {task.comments.slice(-2).map((c: any) => (
                  <div key={c._id} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-blue-600 dark:text-blue-400">{c.user?.name}:</span>
                    <span className="truncate">{c.text}</span>
                    <span className="ml-auto text-xs text-slate-400 flex-shrink-0">{format(new Date(c.createdAt), 'dd MMM')}</span>
                  </div>
                ))}
                <p className="text-xs text-blue-500 mt-2">Click to open chat →</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Detail Modal with Chat */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={() => { setEditTask(selectedTask); setSelectedTask(null) }}
        />
      )}
    </DashboardLayout>
  )
}
