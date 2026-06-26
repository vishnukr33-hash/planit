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

export default function TaskModal({ task, onClose, defaultAssignTo }: Props) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isEdit = !!task
  const isAdmin = user?.role === 'admin'
  const canAssign = user?.role !== 'user'

  // Determine if the current user is the creator or just the assignee
  const isCreator = task?.assignedBy?._id === user?._id
  const isAssignedToMe = task?.assignedTo?._id === user?._id
  const isSelfAssigned = task ? task.assignedBy?._id === task.assignedTo?._id : false

  // If editing: assignee on someone else's task can only change status
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Status-only edit: just send the status
    if (statusOnlyEdit) {
      mutation.mutate({ status: form.status })
      return
    }

    if (!form.title.trim()) return toast.error('Title is required')
    if (!form.dueDate) return toast.error('Due Date is required')
    if (!form.dueTime) return toast.error('Due Time is required')
    const payload: any = {
      title: form.title,
      description: form.description,
      status: form.status,
      category: form.category,
      priority: form.priority,
      dueDate: new Date(form.dueDate + 'T' + form.dueTime).toISOString(),
    }
    if (form.assignedTo) payload.assignedTo = form.assignedTo
    if (form.isRecurring) payload.isRecurring = true
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
          <h2 className="text-lg font-semibold">
            {isEdit ? (statusOnlyEdit ? 'Update Status' : 'Edit Task') : 'New Task'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title — read-only for status-only edit */}
          <div>
            <label className="label">Task Title {!statusOnlyEdit && '*'}</label>
            {statusOnlyEdit ? (
              <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.title}</p>
            ) : (
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Enter task title" required />
            )}
          </div>

          {/* Description — read-only for status-only edit */}
          <div>
            <label className="label">Description</label>
            {statusOnlyEdit ? (
              <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed min-h-[60px]">{form.description || '—'}</p>
            ) : (
              <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Task description..." />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status — always editable */}
            <div>
              <label className="label">Status</label>
              {isEdit ? (
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {statusOptions.map(s => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <input className="input bg-slate-50 dark:bg-slate-700/50" value="Pending" readOnly />
              )}
            </div>

            {/* Priority — read-only for status-only edit */}
            <div>
              <label className="label">Priority</label>
              {statusOnlyEdit ? (
                <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.priority}</p>
              ) : (
                <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category — read-only for status-only edit */}
            <div>
              <label className="label">Category</label>
              {statusOnlyEdit ? (
                <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.category}</p>
              ) : (
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              )}
            </div>

            {/* Due Date — read-only for status-only edit */}
            <div>
              <label className="label">Due Date {!statusOnlyEdit && '*'}</label>
              {statusOnlyEdit ? (
                <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.dueDate || '—'}</p>
              ) : (
                <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} min={format(new Date(), 'yyyy-MM-dd')} required />
              )}
            </div>
          </div>

          {/* Due Time — read-only for status-only edit */}
          {!statusOnlyEdit && (
            <div>
              <label className="label">Due Time *</label>
              <input type="time" className="input" value={form.dueTime} onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))} min={form.dueDate === format(new Date(), 'yyyy-MM-dd') ? format(new Date(), 'HH:mm') : undefined} required />
            </div>
          )}
          {statusOnlyEdit && (
            <div>
              <label className="label">Due Time</label>
              <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{form.dueTime || '—'}</p>
            </div>
          )}

          {/* Assign To — read-only for status-only edit */}
          {canAssign && !statusOnlyEdit && (
            <div>
              <label className="label">Assign To</label>
              <select className="input" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Self</option>
                {usersData?.users?.map((u: any) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.employeeCode})</option>
                ))}
              </select>
            </div>
          )}

          {/* Monthly Recurring toggle */}
          {!statusOnlyEdit && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <label className="label mb-0">Monthly Recurring</label>
                <p className="text-xs text-slate-400">Task repeats on the same date every month</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${form.isRecurring ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isRecurring ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          )}
          {statusOnlyEdit && task?.assignedTo?.name && (
            <div>
              <label className="label">Assigned To</label>
              <p className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed">{task.assignedTo.name}</p>
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
