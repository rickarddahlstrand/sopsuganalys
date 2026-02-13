import { motion } from 'framer-motion'
import InfoButton from './InfoButton'
import { useData } from '../../context/DataContext'

export default function SectionWrapper({ id, title, icon: Icon, info, children }) {
  const { state } = useData()
  const printMode = state.printMode

  const content = (
    <>
      <div className={`flex items-center gap-3 mb-6 ${printMode ? 'mb-4' : ''}`}>
        {Icon && (
          <div className={`p-2 rounded-lg ${printMode ? 'bg-slate-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
            <Icon className={`${printMode ? 'w-6 h-6 text-slate-600' : 'w-5 h-5 text-slate-600 dark:text-slate-400'}`} />
          </div>
        )}
        <h2 className={printMode ? 'text-2xl font-bold text-slate-900' : 'text-xl font-bold'}>{title}</h2>
        {info && <InfoButton text={info} />}
      </div>
      {children}
    </>
  )

  if (printMode) {
    return (
      <section id={id} data-section={id} className="scroll-mt-20 pt-6">
        {content}
      </section>
    )
  }

  return (
    <motion.section
      id={id}
      data-section={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4 }}
      className="scroll-mt-20"
    >
      {content}
    </motion.section>
  )
}
