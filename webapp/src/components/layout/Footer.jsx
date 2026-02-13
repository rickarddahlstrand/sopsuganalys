/* global __COMMIT_HASH__, __COMMIT_DATE__ */
const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'
const commitDate = typeof __COMMIT_DATE__ !== 'undefined' ? __COMMIT_DATE__ : ''

export function getVersionString() {
  return commitDate ? `v${commitDate} (${commitHash})` : commitHash
}

export default function Footer() {
  const version = getVersionString()

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sopsuganalys &copy; {new Date().getFullYear()} Rickard Dahlstrand
          </p>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            All analys sker lokalt — ingen data skickas över Internet
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 dark:text-slate-600 font-mono">{version}</span>
          <a
            href="https://github.com/rickarddahlstrand/sopsuganalys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
