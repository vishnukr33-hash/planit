'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createTask, updateTask, getUsers } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { STATUSES, CATEGORIES, PRIORITIES } from '@/lib/constants'
import toast from 'react-hot-toast'
import clsx from 'clsx'

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

  // Self-assigned = team member created task for themselves (not admin-assigned)
  const isSelfAssigned = !isAdmin && isEdit &&
    task?.assignedTo?._id === user?._id &&
    task?.assignedBy?._id === user?._id

  // Full edit access: admin always, or team member editing their own self-created task
  const canEditAllFields = isAdmin || !isEdit || isSelfAssigned

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'Pending',
    category: task?.category || 'Others',
    priority: task?.priority || 'Medium',
    dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
    dueTime: task?.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '09:00',
    assignedTo: task?.assignedTo?._id || defaultAssignTo || '',
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers({ limit: 100 }).then(r => r.data),
    enabled: isAdmin,
  })

  const mutation = useMutation({
    mutationFn: (data: object) => isEdit ? updateTask(task._id, data) : createTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(isEdit ? 'Task updated' : 'Task created')
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error saving task'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    const payload: any = { ...form }
    if (form.dueDate) {
      payload.dueDate = new Date(`${form.dueDate}T${form.dueTime || '09:00'}`).toISOString()
    }
    delete payload.dueTime
    mutation.mutate(payload)
  }

  // Status options: admin gets all, team members only get progress statuses
  const statusOptions = isAdmin
    ? Array.from(STATUSES)
    : ['In Progress', 'Need Discussion', 'Done', 'Delayed']

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Title */}
          <div>
            <label className="label">Task Title * {!canEditAllFields && <span className="text-slate-400 font-normal text-xs">(read-only)</span>}</label>
            <input
              className={clsx('input', !canEditAllFields && 'bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed')}
              value={form.title}
              onChange={e => canEditAllFields ? setForm(f => ({ ...f, title: e.target.value })) : undefined}
              readOnly={!canEditAllFields}
              placeholder="Enter task title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description {!canEditAllFields && <span className="text-slate-400 font-normal text-xs">(read-only)</span>}</label>
            <textarea
              className={clsx('input resize-none', !canEditAllFields && 'bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed')}
              rows={3}
              value={form.description}
              onChange={e => canEditAllFields ? setForm(f => ({ ...f, description: e.target.value })) : undefined}
              readOnly={!canEditAllFields}
              placeholder="Task description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status — team members see only In Progress / Need Discussion / Done / Delayed */}
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {statusOptions.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {/* Priority */}
            <div>
              <label className="label">Priority {!canEditAllFields && <span className="text-slate-400 font-normal text-xs">(read-only)</span>}</label>
              {canEditAllFields ? (
                <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              ) : (
                <input className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed" value={form.priority} readOnly />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="label">Category {!canEditAllFields && <span className="text-slate-400 font-normal text-xs">(read-only)</span>}</label>
              {canEditAllFields ? (
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <input className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed" value={form.category} readOnly />
              )}
            </div>
            {/* Due Date */}
            <div>
              <label className="label">Due Date {!canEditAllFields && <span className="text-slate-400 font-normal text-xs">(read-only)</span>}</label>
              <input
                type="date"
                className={clsx('input', !canEditAllFields && 'bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed')}
                value={form.dueDate}
                onChange={e => canEditAllFields ? setForm(f => ({ ...f, dueDate: e.target.value })) : undefined}
                readOnly={!canEditAllFields}
              />
            </div>
          </div>

          {/* Due Time — only when user can edit */}
          {canEditAllFields && (
            <div>
              <label className="label">Due Time</label>
              <input type="time" className="input" value={form.dueTime}
                onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))} />
            </div>
          )}

          {/* Assign To — admin only */}
          {isAdmin && (
            <div>
              <label className="label">Assign To</label>
              <select className="input" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Self (Admin)</option>
                {usersData?.users?.map((u: any) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.employeeCode})</option>
                ))}
              </select>
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
