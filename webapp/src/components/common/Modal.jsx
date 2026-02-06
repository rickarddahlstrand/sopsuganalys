import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.8, rotate: 15, y: 400, opacity: 0 }}
            transition={{ exit: { ease: 'easeIn', duration: 0.5 } }}
            className="fixed inset-4 sm:inset-8 z-[101] bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold">{title}</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
