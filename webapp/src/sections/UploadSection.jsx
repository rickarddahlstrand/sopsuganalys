import { useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, ShieldCheck, HardDrive, Wind, ArrowRight, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import JSZip from 'jszip'
import { useData } from '../context/DataContext'
import { parseXlsFile } from '../parsers/xlsParser'
import { sortFilesByMonth } from '../parsers/fileSort'

const FEATURES = [
  { icon: Wind, label: 'Energi & drift', desc: 'Förbruknings\u00ADtrender, fraktioner, maskinstatus' },
  { icon: HardDrive, label: 'Ventil\u00ADanalys', desc: 'Tillgänglighet, feltyper, gren\u00ADhälsa' },
  { icon: ShieldCheck, label: 'Rekommendationer', desc: 'Prioriterade åtgärder baserat på data' },
]

export default function UploadSection() {
  const { dispatch } = useData()
  const [dragOver, setDragOver] = useState(false)
  const [files, setFiles] = useState([])
  const [parsing, setParsing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const inputRef = useRef()

  const extractFromZip = async (zipFile) => {
    const zip = await JSZip.loadAsync(zipFile)
    const xlsEntries = Object.values(zip.files).filter(f => {
      if (f.dir) return false
      const name = f.name.split('/').pop()
      // Skip macOS resource forks and hidden files
      if (name.startsWith('.') || name.startsWith('._')) return false
      if (f.name.includes('__MACOSX')) return false
      return name.endsWith('.xls') || name.endsWith('.xlsx')
    })
    const extracted = []
    for (const entry of xlsEntries) {
      const buf = await entry.async('arraybuffer')
      const name = entry.name.split('/').pop()
      extracted.push(new File([buf], name))
    }
    return extracted
  }

  const handleFiles = useCallback(async (fileList) => {
    const allFiles = Array.from(fileList)
    const xlsFiles = []

    // Extract .xls from zip files, pass through direct .xls files
    for (const f of allFiles) {
      if (f.name.endsWith('.zip')) {
        try {
          const extracted = await extractFromZip(f)
          xlsFiles.push(...extracted)
        } catch (err) {
          console.error(`Failed to unzip ${f.name}:`, err)
        }
      } else if (f.name.endsWith('.xls') || f.name.endsWith('.xlsx')) {
        xlsFiles.push(f)
      }
    }
    if (xlsFiles.length === 0) return

    setFiles(xlsFiles.map(f => ({ name: f.name, status: 'pending' })))
    setParsing(true)

    const parsed = []
    for (let i = 0; i < xlsFiles.length; i++) {
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'parsing' } : f
      ))
      setProgress(Math.round(((i) / xlsFiles.length) * 100))

      try {
        const result = await parseXlsFile(xlsFiles[i])
        parsed.push(result)
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'done' } : f
        ))
      } catch (err) {
        console.error(`Failed to parse ${xlsFiles[i].name}:`, err)
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error' } : f
        ))
      }
    }

    setProgress(100)
    const sorted = sortFilesByMonth(parsed)
    dispatch({ type: 'SET_PARSED_FILES', payload: sorted })
    setParsing(false)
  }, [dispatch])

  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const hasFiles = files.length > 0

  return (
    <div className="w-full max-w-3xl mx-auto py-8 sm:py-12">
      {/* Hero area */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-10"
      >
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 text-slate-900 dark:text-slate-50">
          Analysera dina servicerapporter
        </h2>
        <p className="text-base text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          Ladda upp servicerapporter i Excel-format för att få en interaktiv analys med trender, diagram och åtgärdsförslag.
        </p>
      </motion.div>

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !parsing && inputRef.current?.click()}
          className={`relative group rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 cursor-pointer ${
            dragOver
              ? 'bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
              : 'bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700/80 hover:ring-slate-300 dark:hover:ring-slate-600'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xls,.xlsx,.zip"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />

          {/* Animated icon area */}
          <motion.div
            animate={dragOver ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mb-5"
          >
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl transition-colors duration-300 ${
              dragOver
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
            }`}>
              <Upload className="w-7 h-7" strokeWidth={1.5} />
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {dragOver ? (
              <motion.div
                key="drop"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  Släpp filerna här
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Dra filer hit eller klicka för att välja
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5">
                  .xls / .xlsx / .zip — en eller flera månader och år
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* File list + progress */}
      <AnimatePresence>
        {hasFiles && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-1.5">
              {parsing && (
                <div className="mb-3 px-1">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Läser in filer...</span>
                    <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
              {files.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="flex items-center gap-3 text-sm px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-200/60 dark:ring-slate-700/40"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{f.name}</span>
                  {f.status === 'parsing' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  {f.status === 'done' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </motion.div>
                  )}
                  {f.status === 'error' && <span className="text-red-500 text-xs font-medium">Fel</span>}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature cards */}
      {!hasFiles && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8"
        >
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white dark:bg-slate-800/40 ring-1 ring-slate-200/80 dark:ring-slate-700/50"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                <feat.icon className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{feat.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{feat.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Privacy footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-8 flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium mx-auto w-fit"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Alla filer processas lokalt — inget lämnar din dator</span>
      </motion.div>

      {/* Instructions section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="mt-12"
      >
        <button
          onClick={() => setShowInstructions(s => !s)}
          className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition-colors ring-1 ring-slate-200 dark:ring-slate-700"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            Hur exporterar jag servicerapporter?
          </span>
          {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 ring-1 ring-slate-200/80 dark:ring-slate-700/50">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">1</div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Logga in på sopsugens adminsida</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Använd dina vanliga inloggningsuppgifter för att komma åt adminpanelen.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 ring-1 ring-slate-200/80 dark:ring-slate-700/50">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">2</div>
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Välj "Rapporter" och sedan "Service-rapporter"</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Om du inte ser dessa alternativ i menyn, kontakta din driftpartner för att få åtkomst.</p>
                    </div>
                    <div className="flex-shrink-0 w-48 rounded-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
                      <img src="/step1.gif" alt="Navigera till service-rapporter" className="w-full" />
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 ring-1 ring-slate-200/80 dark:ring-slate-700/50">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">3</div>
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Ladda ner varje rapport i Excel-format</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Klicka på Excel-ikonen för varje månad du vill analysera. Du kan ladda ner flera månader och år.</p>
                    </div>
                    <div className="flex-shrink-0 w-48 rounded-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
                      <img src="/step2.gif" alt="Ladda ner Excel-rapport" className="w-full" />
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200/80 dark:ring-emerald-800/50">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">4</div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Ladda upp filerna ovan</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Dra filerna till uppladdningsytan eller klicka för att välja. Du kan även ladda upp en zip-fil med alla rapporter.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
