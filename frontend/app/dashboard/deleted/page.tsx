'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTrashTasks, restoreTask, permanentDeleteTask } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/lib/store'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function DeletedPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['trash-tasks'],
    queryFn: () => getTrashTasks().then(r => r.data),
  })

  const restoreMutation = useMutation({
    mutationFn: restoreTask,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trash-tasks'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task restored') },
  })

  const deleteMutation = useMutation({
    mutationFn: permanentDeleteTask,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trash-tasks'] }); toast.success('Permanently deleted') },
  })

  return (
    <DashboardLayout title="Deleted Tasks">
      <div className="space-y-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Tasks in trash are automatically deleted after 6 months.</p>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold">Trash ({data?.total || 0} tasks)</h2>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : !data?.tasks?.length ? (
            <p className="text-center py-12 text-slate-400">Trash is empty</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Task', 'Status', 'Priority', 'Deleted On', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {data.tasks.map((task: any) => (
                    <tr key={task._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">{task.title}</td>
                      <td className="py-3 px-4 text-xs">{task.status}</td>
                      <td className="py-3 px-4 text-xs">{task.priority}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {task.deletedAt ? format(new Date(task.deletedAt), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => restoreMutation.mutate(task._id)}
                            className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100">Restore</button>
                          {(user?.role === 'admin' || user?.role === 'head') && (
                            <button onClick={() => { if (confirm('Permanently delete?')) deleteMutation.mutate(task._id) }}
                              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">Delete Forever</button>
                          )}
                        </div>
                      </td>
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
