export default function StatusBadge({ status, label }) {
  const colors = {
    critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    warning: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    ok: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.info}`}>
      {label}
    </span>
  )
}
