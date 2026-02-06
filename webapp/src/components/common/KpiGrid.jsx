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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {Array.isArray(children) ? children.map((child, i) => (
        <motion.div key={i} variants={item}>{child}</motion.div>
      )) : <motion.div variants={item}>{children}</motion.div>}
    </motion.div>
  )
}
