import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import Header from './Header'

export default function StickyNav({ sections }) {
  const { dark, toggle } = useTheme()
  const [activeId, setActiveId] = useState(sections[0]?.id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  const scrollTo = id => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-slate-800/50">
      <div className="px-3 sm:px-4">
        <div className="flex items-center gap-3 py-2">
          <Header />
          <div className="h-5 w-px bg-slate-300 dark:bg-slate-700 shrink-0" />
          <div className="flex gap-0.5 flex-wrap flex-1">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  activeId === s.id
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={toggle}
            className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
            aria-label={dark ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </nav>
  )
}
