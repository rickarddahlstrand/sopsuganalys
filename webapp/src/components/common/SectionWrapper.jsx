import { motion } from 'framer-motion'
import InfoButton from './InfoButton'

export default function SectionWrapper({ id, title, icon: Icon, info, children }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4 }}
      className="scroll-mt-20"
    >
      <div className="flex items-center gap-3 mb-6">
        {Icon && (
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </div>
        )}
        <h2 className="text-xl font-bold">{title}</h2>
        {info && <InfoButton text={info} />}
      </div>
      {children}
    </motion.section>
  )
}
