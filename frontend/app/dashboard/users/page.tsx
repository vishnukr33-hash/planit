'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, toggleUserStatus, deleteUser, resetUserPassword } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface UserForm {
  employeeCode: string; name: string; email: string; username: string; password: string; phone: string; status: string
}

const emptyForm: UserForm = { employeeCode: '', name: '', email: '', username: '', password: '', phone: '', status: 'active' }

export default function UsersPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [resetModal, setResetModal] = useState<any>(null)
  const [newPass, setNewPass] = useState('')

  if (user?.role !== 'admin') { router.push('/dashboard'); return null }

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => getUsers({ search, limit: 50 }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => editUser ? updateUser(editUser._id, data) : createUser(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(editUser ? 'User updated' : 'User created'); closeModal() },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  })

  const toggleMutation = useMutation({
    mutationFn: toggleUserStatus,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Status updated') },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted') },
  })

  const resetMutation = useMutation({
    mutationFn: () => resetUserPassword(resetModal._id, newPass),
    onSuccess: () => { toast.success('Password reset'); setResetModal(null); setNewPass('') },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  })

  const openEdit = (u: any) => { setEditUser(u); setForm({ employeeCode: u.employeeCode, name: u.name, email: u.email, username: u.username, password: '', phone: u.phone || '', status: u.status }); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditUser(null); setForm(emptyForm) }

  return (
    <DashboardLayout title="User Management">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <input className="input max-w-xs text-sm" placeholder="🔍 Search users..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex-1" />
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <span>+</span> Add User
          </button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold">Team List</h2>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['E.Code', 'Name', 'Email ID', 'Phone', 'Username', 'Password', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {(data?.users || []).map((u: any) => (
                    <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">{u.employeeCode}</td>
                      <td className="py-3 px-4 font-medium">{u.name}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{u.email}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {u.phone
                          ? <span className="flex items-center gap-1"><span className="text-green-500">📱</span>{u.phone}</span>
                          : <span className="text-slate-300 dark:text-slate-600 text-xs italic">—</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{u.username}</td>
                      <td className="py-3 px-4">
                        <button onClick={() => setResetModal(u)} className="text-xs text-blue-600 hover:underline">Reset</button>
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => toggleMutation.mutate(u._id)}
                          className={clsx('relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            u.status === 'active' ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600')}>
                          <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                            u.status === 'active' ? 'translate-x-6' : 'translate-x-1')} />
                        </button>
                        <span className={clsx('ml-2 text-xs', u.status === 'active' ? 'text-green-600' : 'text-slate-400')}>
                          {u.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500">✏️</button>
                          <button onClick={() => { if (confirm(`Delete ${u.name}?`)) deleteMutation.mutate(u._id) }}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.users?.length && <p className="text-center py-8 text-slate-400">No users found</p>}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="card w-full max-w-md animate-slide-in">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold">{editUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Employee Code *</label>
                  <input className="input" value={form.employeeCode} onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="label">Email ID *</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="label">WhatsApp Number <span className="text-slate-400 font-normal text-xs">(with country code, e.g. 919876543210)</span></label>
                <input className="input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="919876543210" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Username *</label>
                  <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">{editUser ? 'New Password' : 'Password *'}</label>
                  <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!editUser} />
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? 'Saving...' : editUser ? 'Update' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="card w-full max-w-sm animate-slide-in p-6">
            <h2 className="text-lg font-semibold mb-4">Reset Password — {resetModal.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <input className="input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 6 characters" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setResetModal(null); setNewPass('') }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => resetMutation.mutate()} disabled={newPass.length < 6 || resetMutation.isPending} className="btn-primary flex-1">
                  {resetMutation.isPending ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
