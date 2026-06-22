'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTasks, getUsers } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import TaskTable from '@/components/tasks/TaskTable'
import TaskModal from '@/components/tasks/TaskModal'
import { useAuthStore } from '@/lib/store'
import { useSearchParams } from 'next/navigation'
import clsx from 'clsx'

export default function TeamTasksPage() {
  const { user } = useAuthStore()
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  const statusFilter = searchParams.get('status') || ''
  const filterType = searchParams.get('filter') || '' // 'overdue'

  const activeFilterLabel = filterType === 'overdue'
    ? 'Overdue Tasks'
    : statusFilter
    ? `Status: ${statusFilter}`
    : null

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers({ limit: 100, status: 'active' }).then(r => r.data),
    enabled: user?.role === 'admin',
  })

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', 'team', statusFilter, filterType],
    queryFn: () => getTasks({
      isTeamTask: true,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filterType ? { filter: filterType } : {}),
    }).then(r => r.data),
  })

  const toggleUser = (id: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Auto-expand all users when a filter is active
  useEffect(() => {
    if ((statusFilter || filterType) && usersData?.users) {
      setExpandedUsers(new Set(usersData.users.map((u: any) => u._id)))
    }
  }, [statusFilter, filterType, usersData])

  const getTasksForUser = (userId: string) =>
    (tasksData?.tasks || []).filter((t: any) => t.assignedTo?._id === userId)

  // For regular users: show flat list of tasks assigned to them
  if (user?.role === 'user') {
    return (
      <DashboardLayout title="Team Tasks">
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold">Tasks Assigned to Me</h2>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <TaskTable tasks={(tasksData?.tasks || []).filter((t: any) => t.assignedTo?._id === user?._id)} />
          )}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Team Tasks">
      <div className="space-y-4">
        {/* Active filter banner */}
        {activeFilterLabel && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span>🔎 Filtered by: <strong>{activeFilterLabel}</strong></span>
            <a href="/dashboard/team-tasks" className="ml-auto text-blue-400 hover:text-blue-600 font-bold">✕ Clear</a>
          </div>
        )}

        {/* Toolbar */}
        <div className="card p-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">{tasksData?.total || 0} total team tasks</p>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <span>+</span> Assign Task
          </button>
        </div>

        {/* Team sections */}
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {(usersData?.users || []).map((member: any, idx: number) => {
              const memberTasks = getTasksForUser(member._id)
              const isExpanded = expandedUsers.has(member._id)
              const doneTasks = memberTasks.filter((t: any) => t.status === 'Done').length
              const pendingAccept = memberTasks.filter((t: any) => t.status === 'Pending').length

              return (
                <div key={member._id} className="card overflow-hidden">
                  <button
                    onClick={() => toggleUser(member._id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left">
                    <span className={clsx('w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-transform', isExpanded ? 'rotate-90' : '')}>▶</span>
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {member.name[0]}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">Team-{idx + 1} — {member.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({member.employeeCode})</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500">{memberTasks.length} tasks</span>
                      {pendingAccept > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-medium">
                          {pendingAccept} accept pending
                        </span>
                      )}
                      {doneTasks > 0 && (
                        <span className="text-green-600 dark:text-green-400">{doneTasks} done</span>
                      )}
                      <button onClick={e => { e.stopPropagation(); setSelectedUser(member._id); setShowModal(true) }}
                        className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-colors font-bold">
                        +
                      </button>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-700 animate-fade-in">
                      {memberTasks.length > 0 ? (
                        <TaskTable tasks={memberTasks} />
                      ) : (
                        <p className="text-center py-6 text-slate-400 text-sm">No tasks assigned</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <TaskModal
          onClose={() => { setShowModal(false); setSelectedUser(null) }}
          defaultAssignTo={selectedUser || undefined}
          isTeamTask
        />
      )}
    </DashboardLayout>
  )
}
