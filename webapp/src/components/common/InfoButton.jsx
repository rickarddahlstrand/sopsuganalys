import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function InfoButton({ text, size = 16 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const tipRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Position tooltip relative to the button
  const updatePosition = useCallback(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const tipWidth = 448 // max-w-md ≈ 28rem = 448px
    let left = rect.left + rect.width / 2 - tipWidth / 2
    // Keep within viewport
    if (left < 16) left = 16
    if (left + tipWidth > window.innerWidth - 16) left = window.innerWidth - 16 - tipWidth
    setPos({
      top: rect.bottom + window.scrollY + 8,
      left: left + window.scrollX,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current?.contains(e.target)) return
      if (tipRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const tooltip = open ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={tipRef}
        initial={{ opacity: 0, y: 4, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        style={{ position: 'absolute', top: pos.top, left: pos.left }}
        className="z-[9999] w-[28rem] max-w-[calc(100vw-2rem)] p-4 rounded-lg shadow-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs leading-relaxed text-slate-600 dark:text-slate-300"
      >
        <div className="whitespace-pre-line">{text}</div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  ) : null

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-colors focus:outline-none"
        aria-label="Mer information"
      >
        <Info size={size} />
      </button>
      {tooltip}
    </span>
  )
}
