'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createTask, updateTask, getSubordinates } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { STATUSES, CATEGORIES, PRIORITIES } from '@/lib/constants'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface Props {
  task?: any
  onClose: () => void
  defaultAssignTo?: string
  isTeamTask?: boolean
}

export default function TaskModal({ task, onClose, defaultAssignTo, isTeamTask }: Props) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isEdit = !!task
  const isAdmin = user?.role === 'admin'
  const canAssign = user?.role !== 'user'

  const isCreator = task?.assignedBy?._id === user?._id
  const isAssignedToMe = task?.assignedTo?._id === user?._id
  const isSelfAssigned = task ? task.assignedBy?._id === task.assignedTo?._id : false
  const statusOnlyEdit = isEdit && !isAdmin && !isCreator && isAssignedToMe && !isSelfAssigned

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'Pending',
    category: task?.category || 'Others',
    priority: task?.priority || 'Medium',
    dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
    dueTime: task?.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '09:00',
    assignedTo: task?.assignedTo?._id || defaultAssignTo || '',
    isRecurring: task?.isRecurring || false,
    isShared: task?.isShared || false,
    sharedWith: task?.sharedWith?.map((u: any) => u._id || u) || [] as string[],
  })

  const { data: usersData } = useQuery({
    queryKey: ['subordinates'],
    queryFn: () => getSubordinates().then(r => r.data),
    enabled: canAssign,
  })

  const mutation = useMutation({
    mutationFn: (data: object) => isEdit ? updateTask(task._id, data) : createTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success(isEdit ? 'Task updated' : 'Task created')
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error saving task'),
  })

  const toggleSharedUser = (userId: string) => {
    setForm(f => ({
      ...f,
      sharedWith: f.sharedWith.includes(userId)
        ? f.sharedWith.filter((id: string) => id !== userId)
        : [...f.sharedWith, userId]
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (statusOnlyEdit) { mutation.mutate({ status: form.status }); return }
    if (!form.title.trim()) return toast.error('Title is required')
    if (!form.dueDate) return toast.error('Due Date is required')
    if (!form.dueTime) return toast.error('Due Time is required')
    if (isTeamTask && !form.isShared && !form.assignedTo) return toast.error('Please select a team member')
    if (form.isShared && form.sharedWith.length === 0) return toast.error('Please select at least one team member for shared task')

    const payload: any = {
      title: form.title,
      description: form.description,
      status: form.status,
      category: form.category,
      priority: form.priority,
      dueDate: new Date(form.dueDate + 'T' + form.dueTime).toISOString(),
      isRecurring: form.isRecurring || undefined,
    }
    if (form.isShared) {
      payload.isShared = true
      payload.sharedWith = form.sharedWith
    } else if (form.assignedTo) {
      payload.assignedTo = form.assignedTo
    }
    mutation.mutate(payload)
  }

  const statusOptions = !isEdit
    ? ['Pending']
    : isAdmin || isCreator
    ? Array.from(STATUSES)
    : ['In Progress', 'Need Discussion', 'Done', 'Delayed']

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">{isEdit ? (statusOnlyEdit ? 'Update Status' : 'Edit Task') : 'New Task'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="label">Task Title {!statusOnlyEdit && '*'}</label>
            {statusOnlyEdit
              ? <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.title}</p>
              : <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Enter task title" required />}
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            {statusOnlyEdit
              ? <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed min-h-[60px]">{form.description || '—'}</p>
              : <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Task description..." />}
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              {isEdit
                ? <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{statusOptions.map(s => <option key={s}>{s}</option>)}</select>
                : <input className="input bg-slate-50 dark:bg-slate-700/50" value="Pending" readOnly />}
            </div>
            <div>
              <label className="label">Priority</label>
              {statusOnlyEdit
                ? <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.priority}</p>
                : <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>}
            </div>
          </div>

          {/* Category + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              {statusOnlyEdit
                ? <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.category}</p>
                : <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>}
            </div>
            <div>
              <label className="label">Due Date {!statusOnlyEdit && '*'}</label>
              {statusOnlyEdit
                ? <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.dueDate || '—'}</p>
                : <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} min={format(new Date(), 'yyyy-MM-dd')} required />}
            </div>
          </div>

          {/* Due Time */}
          {!statusOnlyEdit
            ? <div><label className="label">Due Time *</label><input type="time" className="input" value={form.dueTime} onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))} min={form.dueDate === format(new Date(), 'yyyy-MM-dd') ? format(new Date(), 'HH:mm') : undefined} required /></div>
            : <div><label className="label">Due Time</label><p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.dueTime || '—'}</p></div>}

          {/* Assignment section */}
          {canAssign && !statusOnlyEdit && (
            <>
              {/* Shared Task toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="label mb-0">👥 Shared Task</label>
                  <p className="text-xs text-slate-400">Assign to multiple team members</p>
                </div>
                <button type="button" onClick={() => setForm(f => ({ ...f, isShared: !f.isShared, sharedWith: [], assignedTo: '' }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.isShared ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isShared ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              {/* Multi-select for shared task */}
              {form.isShared ? (
                <div>
                  <label className="label">Select Team Members * ({form.sharedWith.length} selected)</label>
                  <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {usersData?.users?.length === 0 ? (
                      <p className="text-sm text-slate-400 p-3">No team members available</p>
                    ) : usersData?.users?.map((u: any) => (
                      <label key={u._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.sharedWith.includes(u._id)}
                          onChange={() => toggleSharedUser(u._id)}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                          {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.employeeCode} · {u.role}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {form.sharedWith.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">✓ Shared with: {usersData?.users?.filter((u: any) => form.sharedWith.includes(u._id)).map((u: any) => u.name).join(', ')}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="label">{isTeamTask ? 'Assign To Team Member *' : 'Assign To'}</label>
                  <select className="input" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                    {isTeamTask ? <option value="">-- Select Team Member --</option> : <option value="">Self</option>}
                    {usersData?.users?.map((u: any) => <option key={u._id} value={u._id}>{u.name} ({u.employeeCode})</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Assigned To read-only for status-only edit */}
          {statusOnlyEdit && task?.assignedTo?.name && (
            <div><label className="label">Assigned To</label><p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{task.assignedTo.name}</p></div>
          )}

          {/* Monthly Recurring toggle */}
          {!statusOnlyEdit && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <label className="label mb-0">Monthly Recurring</label>
                <p className="text-xs text-slate-400">Task repeats on the same date every month</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${form.isRecurring ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isRecurring ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
