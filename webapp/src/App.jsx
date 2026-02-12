import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Info } from 'lucide-react'
import { useData } from './context/DataContext'
import Header from './components/layout/Header'
import StickyNav from './components/layout/StickyNav'
import Footer from './components/layout/Footer'
import UploadSection from './sections/UploadSection'
import DashboardSection from './sections/DashboardSection'
import SammanfattningSection from './sections/SammanfattningSection'
import EnergiSection from './sections/EnergiSection'
import FraktionSection from './sections/FraktionSection'
import VentilerSection from './sections/VentilerSection'
import GrenSection from './sections/GrenSection'
import ManuellSection from './sections/ManuellSection'
import LarmSection from './sections/LarmSection'
import TrendSection from './sections/TrendSection'
import DrifterfarenheterSection from './sections/DrifterfarenheterSection'
import RekommendationerSection from './sections/RekommendationerSection'

const sections = [
  { id: 'dashboard', label: 'Överblick' },
  { id: 'trender', label: 'Trender' },
  { id: 'drifterfarenheter', label: 'Drift' },
  { id: 'rekommendationer', label: 'Åtgärder' },
  { id: 'sammanfattning', label: 'Sammanfattning' },
  { id: 'energi', label: 'Energi' },
  { id: 'fraktioner', label: 'Fraktioner' },
  { id: 'ventiler', label: 'Ventiler' },
  { id: 'grenar', label: 'Grenar' },
  { id: 'manuell', label: 'Manuell' },
  { id: 'larm', label: 'Larm' },
]

function InfoHint() {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)

  useEffect(() => {
    let raf
    let btn

    const track = () => {
      if (!btn) {
        btn = document.querySelector('[aria-label="Mer information"]')
        if (!btn) { raf = requestAnimationFrame(track); return }
        btnRef.current = btn
        setVisible(true)
        btn.addEventListener('mouseenter', () => setVisible(false))
      }
      const rect = btn.getBoundingClientRect()
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 10 })
      raf = requestAnimationFrame(track)
    }

    const startDelay = setTimeout(() => { raf = requestAnimationFrame(track) }, 800)

    return () => {
      clearTimeout(startDelay)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  if (!pos) return null

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -10, scale: 0.9, y: '-50%' }}
          animate={{ opacity: 1, x: 0, scale: 1, y: '-50%' }}
          exit={{ opacity: 0, x: -8, scale: 0.92, y: '-50%' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[9998] pointer-events-none flex items-center print:hidden"
        >
          {/* Arrow pointing left */}
          <div className="-mr-1.5 w-2 h-2 rotate-45 bg-emerald-600 dark:bg-emerald-500" />
          {/* Tooltip body */}
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="px-4 py-2 rounded-full bg-emerald-600 dark:bg-emerald-500 shadow-lg shadow-emerald-600/25 dark:shadow-emerald-500/15"
          >
            <p className="text-xs font-medium text-white whitespace-nowrap flex items-center gap-1.5">
              Hovra över
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/25 backdrop-blur-sm">
                <Info className="w-2.5 h-2.5 text-white" />
              </span>
              för detaljer
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default function App() {
  const { state } = useData()
  const hasData = state.parsedFiles !== null

  if (!hasData) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
        <main className="flex-1 flex items-center justify-center px-4">
          <UploadSection />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <StickyNav sections={sections} />
      <InfoHint />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 space-y-12 mt-4">
        <DashboardSection />
        <TrendSection />
        <DrifterfarenheterSection />
        <RekommendationerSection />
        <SammanfattningSection />
        <EnergiSection />
        <FraktionSection />
        <VentilerSection />
        <GrenSection />
        <ManuellSection />
        <LarmSection />
      </main>
      <Footer />
    </div>
  )
}
