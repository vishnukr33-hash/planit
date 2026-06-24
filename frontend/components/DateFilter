'use client'
import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

interface DateFilterProps {
  onChange: (range: { startDate: string; endDate: string }) => void
  defaultMode?: 'month' | 'custom'
}

export default function DateFilter({ onChange, defaultMode = 'month' }: DateFilterProps) {
  const [mode, setMode] = useState<'month' | 'custom'>(defaultMode)
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Initialize with current month on mount
  useMemo(() => {
    if (defaultMode === 'month') {
      const date = new Date(selectedMonth + '-01')
      onChange({
        startDate: format(startOfMonth(date), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(date), 'yyyy-MM-dd'),
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleModeChange = (newMode: 'month' | 'custom') => {
    setMode(newMode)
    if (newMode === 'month') {
      const date = new Date(selectedMonth + '-01')
      onChange({
        startDate: format(startOfMonth(date), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(date), 'yyyy-MM-dd'),
      })
    } else {
      if (customStart && customEnd) {
        onChange({ startDate: customStart, endDate: customEnd })
      }
    }
  }

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value)
    const date = new Date(value + '-01')
    onChange({
      startDate: format(startOfMonth(date), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(date), 'yyyy-MM-dd'),
    })
  }

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({ startDate: customStart, endDate: customEnd })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
        <button
          onClick={() => handleModeChange('month')}
          className={`px-3 py-1.5 transition-colors ${
            mode === 'month'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          📅 Monthly
        </button>
        <button
          onClick={() => handleModeChange('custom')}
          className={`px-3 py-1.5 transition-colors ${
            mode === 'custom'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          🔧 Custom Range
        </button>
      </div>

      {/* Month picker */}
      {mode === 'month' && (
        <input
          type="month"
          className="input text-sm py-1.5 max-w-[180px]"
          value={selectedMonth}
          onChange={e => handleMonthChange(e.target.value)}
        />
      )}

      {/* Custom range */}
      {mode === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input text-sm py-1.5"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            placeholder="Start date"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            className="input text-sm py-1.5"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            placeholder="End date"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
