import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function Footer() {
  const { dark, toggle } = useTheme()

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sopsugsanalys &copy; Rickard Dahlstrand. All analys sker lokalt i din webbläsare, ingen data skickas över Internet.
        </p>
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={dark ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
        >
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </footer>
  )
}
