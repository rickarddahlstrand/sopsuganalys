import { Fan } from 'lucide-react'

export default function Header() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
        <Fan className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h1 className="text-sm font-bold tracking-tight whitespace-nowrap">
        Servicerapportanalys
      </h1>
    </div>
  )
}
