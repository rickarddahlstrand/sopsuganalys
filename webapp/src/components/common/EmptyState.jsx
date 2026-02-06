import { Loader2 } from 'lucide-react'

export default function EmptyState({ loading, message = 'Ingen data tillgänglig' }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Analyserar...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <span>{message}</span>
    </div>
  )
}
