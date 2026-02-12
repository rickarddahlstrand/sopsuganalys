import { motion } from 'framer-motion'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export default function KpiGrid({ children }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className="flex flex-wrap gap-4"
    >
      {Array.isArray(children) ? children.map((child, i) => (
        <motion.div key={i} variants={item} className="flex-1 basis-48 min-w-0">{child}</motion.div>
      )) : <motion.div variants={item} className="flex-1 basis-48 min-w-0">{children}</motion.div>}
    </motion.div>
  )
}
