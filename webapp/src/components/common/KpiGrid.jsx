import { Children } from 'react'
import { motion } from 'framer-motion'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

// Determine grid columns so items are either on one row or two balanced rows.
// Never leaves a single item alone on a row.
function getGridClass(count) {
  if (count <= 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-3'
  if (count === 4) return 'grid-cols-2 md:grid-cols-4'
  if (count === 5) return 'grid-cols-3 lg:grid-cols-5'
  if (count === 6) return 'grid-cols-2 md:grid-cols-3'
  return 'grid-cols-2 md:grid-cols-4'
}

export default function KpiGrid({ children }) {
  const count = Children.count(children)
  const gridClass = getGridClass(count)

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className={`grid gap-4 ${gridClass}`}
    >
      {Array.isArray(children) ? children.map((child, i) => (
        <motion.div key={i} variants={item}>{child}</motion.div>
      )) : <motion.div variants={item}>{children}</motion.div>}
    </motion.div>
  )
}
