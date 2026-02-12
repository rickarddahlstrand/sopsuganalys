import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import Modal from './Modal'
import InfoButton from './InfoButton'

export default function ChartCard({ title, height = 300, info, controls, children }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</h4>
            {info && <InfoButton text={info} size={14} />}
          </div>
          <div className="flex items-center gap-2">
            {controls}
            <button
              onClick={() => setExpanded(true)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/70 text-slate-400 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div style={{ height }} className="p-2 overflow-hidden">
          {children}
        </div>
      </div>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={title}>
        <div style={{ height: '70vh' }}>
          {children}
        </div>
      </Modal>
    </>
  )
}
