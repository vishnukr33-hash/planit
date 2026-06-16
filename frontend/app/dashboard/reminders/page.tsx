'use client'
import { useQuery } from '@tanstack/react-query'
import { getReminders } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants'
import { format } from 'date-fns'
import clsx from 'clsx'

const TaskCard = ({ task, type }: { task: any; type: 'overdue' | 'today' | 'upcoming' }) => (
  <div className={clsx('p-4 rounded-xl border transition-colors', {
    'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10': type === 'overdue',
    'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10': type === 'today',
    'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10': type === 'upcoming',
  })}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
        {task.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{task.description}</p>}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={clsx('badge', STATUS_COLORS[task.status])}>{task.status}</span>
          <span className={clsx('badge', PRIORITY_COLORS[task.priority])}>{task.priority}</span>
          {task.assignedTo && <span className="text-xs text-slate-500">👤 {task.assignedTo.name}</span>}
        </div>
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
      </div>
    </div>
  </div>
)

const Section = ({ title, tasks, type, icon }: { title: string; tasks: any[]; type: any; icon: string }) => (
  <div className="card p-5">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xl">{icon}</span>
      <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      <span className="ml-auto badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{tasks.length}</span>
    </div>
    {tasks.length > 0 ? (
      <div className="space-y-3">
        {tasks.map(t => <TaskCard key={t._id} task={t} type={type} />)}
      </div>
    ) : (
      <p className="text-sm text-slate-400 text-center py-4">No tasks here 🎉</p>
    )}
  </div>
)

export default function RemindersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => getReminders().then(r => r.data),
    refetchInterval: 60000,
  })

  if (isLoading) return (
    <DashboardLayout title="Reminders">
      <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout title="Reminders">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="Overdue Tasks" tasks={data?.overdue || []} type="overdue" icon="🚨" />
        <Section title="Due Today" tasks={data?.dueToday || []} type="today" icon="📅" />
        <Section title="Upcoming (7 days)" tasks={data?.upcoming || []} type="upcoming" icon="🔜" />
      </div>

      {/* Recent Comments */}
      {data?.recentComments?.length > 0 && (
        <div className="card p-5 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💬</span>
            <h3 className="font-semibold">Recent Team Replies</h3>
          </div>
          <div className="space-y-3">
            {data.recentComments.map((task: any) => (
              <div key={task._id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <p className="font-medium text-sm mb-2">{task.title}</p>
                {task.comments.slice(-2).map((c: any) => (
                  <div key={c._id} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-blue-600 dark:text-blue-400">{c.user?.name}:</span>
                    <span className="truncate">{c.text}</span>
                    <span className="ml-auto text-xs text-slate-400 flex-shrink-0">{format(new Date(c.createdAt), 'dd MMM')}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
