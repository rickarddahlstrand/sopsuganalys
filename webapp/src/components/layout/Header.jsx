import { Fan } from 'lucide-react'
import { useData } from '../../context/DataContext'

export default function Header() {
  const { state } = useData()
  const facilityName = state.facilityName

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
        <Fan className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex flex-col">
        <h1 className="text-sm font-bold tracking-tight whitespace-nowrap leading-tight">
          Servicerapportanalys
        </h1>
        {facilityName && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[200px]">
            {facilityName}
          </span>
        )}
      </div>
    </div>
  )
}
