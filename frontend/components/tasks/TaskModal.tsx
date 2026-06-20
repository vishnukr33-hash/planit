'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createTask, updateTask, getSubordinates } from '@/lib/api'
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
  const canAssign = user?.role !== 'user'

  const isSelfAssigned = !isAdmin && isEdit &&
    task?.assignedTo?._id === user?._id &&
    task?.assignedBy?._id === user?._id

  const canEditAllFields = isAdmin || !isEdit || isSelfAssigned || user?.role === 'head' || user?.role === 'teamlead'

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
    queryKey: ['subordinates'],
    queryFn: () => getSubordinates().then(r => r.data),
    enabled: canAssign,
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
    mutation.mutate(payload)
  }

  const statusOptions = !isEdit
    ? ['Pending']
    : isAdmin
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
          <div>
            <label className="label">Task Title *</label>
            <input className="input" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Enter task title" required />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Task description..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input type="date" className="input" value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required />
            </div>
          </div>

          <div>
            <label className="label">Due Time *</label>
            <input type="time" className="input" value={form.dueTime}
              onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))} required />
          </div>

          {canAssign && (
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
