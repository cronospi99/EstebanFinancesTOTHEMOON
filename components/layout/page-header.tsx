'use client'

import { motion } from 'framer-motion'

/** Encabezado grande al estilo "Large Title" de iOS. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className="pt-safe mb-5 px-5 pt-6"
    >
      <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
      {subtitle && <p className="mt-0.5 text-[14px] text-label-secondary">{subtitle}</p>}
    </motion.header>
  )
}
