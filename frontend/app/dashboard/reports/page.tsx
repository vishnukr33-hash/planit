'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUserActivityReport } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DateFilter from '@/components/layout/DateFilter'
import { useAuthStore } from '@/lib/store'
import clsx from 'clsx'

export default function ReportsPage() {
  const { user } = useAuthStore()
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'user-activity', dateRange],
    queryFn: () => getUserActivityReport({
      ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    }).then(r => r.data),
    enabled: user?.role === 'admin',
  })

  if (user?.role !== 'admin') {
    return (
      <DashboardLayout title="Reports">
        <div className="card p-12 text-center text-slate-400">
          <p className="text-4xl mb-3">🔒</p>
          <p>Admin access required</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Reports">
      <div className="space-y-4">
        {/* Date Filter */}
        <div className="card p-4">
          <DateFilter onChange={setDateRange} defaultMode="month" />
        </div>

        {/* Report Table */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold">📊 User Activity Report</h2>
            <p className="text-xs text-slate-400 mt-1">Login hours, productivity, and task completion metrics</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : !data?.report?.length ? (
            <p className="text-center py-12 text-slate-400">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    {['User', 'Role', 'Total Logins', 'Total Login Hrs', 'Avg Login Hrs', 'Interactions', 'Tasks', 'Completed', 'Productivity %', 'Avg Completion Hrs'].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {data.report.map((row: any) => (
                    <tr key={row._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                            {row.avatar ? <img src={row.avatar} alt="" className="w-full h-full object-cover" /> : row.name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">{row.name}</p>
                            <p className="text-[10px] text-slate-400">{row.employeeCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                          row.role === 'admin' ? 'bg-red-100 text-red-700' :
                          row.role === 'head' ? 'bg-purple-100 text-purple-700' :
                          row.role === 'teamlead' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        )}>{row.role}</span>
                      </td>
                      <td className="py-3 px-3 text-center">{row.totalLogins}</td>
                      <td className="py-3 px-3 text-center">{row.totalLoginHours}h</td>
                      <td className="py-3 px-3 text-center">{row.avgLoginHours}h</td>
                      <td className="py-3 px-3 text-center">{row.totalInteractions}</td>
                      <td className="py-3 px-3 text-center">{row.totalTasks}</td>
                      <td className="py-3 px-3 text-center text-green-600">{row.completedTasks}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={clsx('h-full rounded-full',
                                row.productivity >= 70 ? 'bg-green-500' :
                                row.productivity >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              )}
                              style={{ width: `${Math.min(row.productivity, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{row.productivity}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">{row.avgCompletionHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
