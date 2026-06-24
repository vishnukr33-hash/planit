export const STATUSES = ['Pending', 'In Progress', 'Need Discussion', 'Done', 'Delayed'] as const
export const USER_STATUSES = ['In Progress', 'Need Discussion', 'Done', 'Delayed'] as const
export const ALL_STATUSES = ['Pending', 'In Progress', 'Need Discussion', 'Done', 'Delayed', 'Accepted'] as const
export const CATEGORIES = ['Website Update', 'Legal', 'AI', 'Operations', 'Marketing', 'Development', 'Others'] as const
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const

export const STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Accepted': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  'In Progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Need Discussion': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'Done': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Delayed': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export const PRIORITY_COLORS: Record<string, string> = {
  'Low': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  'Medium': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'High': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Critical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Website Update': 'bg-cyan-100 text-cyan-700',
  'Legal': 'bg-indigo-100 text-indigo-700',
  'AI': 'bg-violet-100 text-violet-700',
  'Operations': 'bg-amber-100 text-amber-700',
  'Marketing': 'bg-pink-100 text-pink-700',
  'Development': 'bg-emerald-100 text-emerald-700',
  'Others': 'bg-slate-100 text-slate-700',
}
