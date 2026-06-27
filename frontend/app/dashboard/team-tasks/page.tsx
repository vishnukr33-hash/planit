'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTasks, getUsers, exportTasks, getTeamProductivity } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import TaskTable from '@/components/tasks/TaskTable'
import TaskModal from '@/components/tasks/TaskModal'
import DateFilter from '@/components/layout/DateFilter'
import { useAuthStore } from '@/lib/store'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function TeamTasksPage() {
  const { user } = useAuthStore()
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  // Date range state
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' })

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
    enabled: user?.role !== 'user',
  })

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', 'team', statusFilter, filterType, dateRange],
    queryFn: () => getTasks({
      isTeamTask: true,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filterType ? { filter: filterType } : {}),
      ...(!statusFilter && !filterType && dateRange.startDate ? { startDate: dateRange.startDate } : {}),
      ...(!statusFilter && !filterType && dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    }).then(r => r.data),
  })

  // Team productivity data
  const { data: productivityData } = useQuery({
    queryKey: ['team-productivity', dateRange],
    queryFn: () => getTeamProductivity({
      ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    }).then(r => r.data),
    enabled: user?.role !== 'user',
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

  const getProductivityForUser = (userId: string) =>
    (productivityData?.userProductivity || []).find((p: any) => p._id === userId)

  const handleExport = async () => {
    try {
      const params: any = { isTeamTask: true }
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate
      const response = await exportTasks(params)
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `team-tasks-${dateRange.startDate || 'all'}-to-${dateRange.endDate || 'all'}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    }
  }

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
        {/* Date Filter */}
        <div className="card p-4">
          <DateFilter onChange={setDateRange} defaultMode="month" />
        </div>

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
          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
              📥 Export Excel
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
              <span>+</span> Assign Task
            </button>
          </div>
        </div>

        {/* Team Productivity Summary */}
        {productivityData?.userProductivity?.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold mb-4">📊 Individual Productivity</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Team Member', 'Assigned', 'Completed', 'In Progress', 'Pending', 'Overdue', 'Completion %'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {productivityData.userProductivity.map((p: any) => (
                    <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="py-2 px-3">{p.total}</td>
                      <td className="py-2 px-3 text-green-600 dark:text-green-400">{p.done}</td>
                      <td className="py-2 px-3 text-blue-600 dark:text-blue-400">{p.inProgress}</td>
                      <td className="py-2 px-3 text-yellow-600 dark:text-yellow-400">{p.pending}</td>
                      <td className="py-2 px-3 text-red-600 dark:text-red-400">{p.overdue}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={clsx('h-full rounded-full', p.productivity >= 70 ? 'bg-green-500' : p.productivity >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
                              style={{ width: `${Math.min(p.productivity, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{Math.round(p.productivity)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Team sections */}
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : !(usersData?.users?.length) ? (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold">All Team Tasks</h2>
            </div>
            <TaskTable tasks={tasksData?.tasks || []} showAssignee />
          </div>
        ) : (
          <div className="space-y-3">
            {(usersData?.users || []).map((member: any, idx: number) => {
              const memberTasks = getTasksForUser(member._id)
              const memberProd = getProductivityForUser(member._id)
              const isExpanded = expandedUsers.has(member._id)
              const doneTasks = memberTasks.filter((t: any) => t.status === 'Done').length

              return (
                <div key={member._id} className="card overflow-hidden">
                  <button
                    onClick={() => toggleUser(member._id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left">
                    <span className={clsx('w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-transform', isExpanded ? 'rotate-90' : '')}>▶</span>
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                      {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" /> : member.name[0]}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">Team-{idx + 1} — {member.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({member.employeeCode})</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500">{memberTasks.length} tasks</span>
                      {memberProd && (
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',
                          memberProd.productivity >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          memberProd.productivity >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        )}>
                          {Math.round(memberProd.productivity)}% done
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
