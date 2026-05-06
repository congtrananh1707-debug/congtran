import { useEffect } from 'react'
import { motion } from 'framer-motion'

const ITEMS = ['🎉','⭐','🎊','✨','🌟','💫','🏆','🎈','🥳','🍀']

export default function Confetti({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 28 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-3xl select-none"
          style={{ left: `${(i * 37 + 5) % 100}%` }}
          initial={{ y: '-10vh', rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: (i % 2 === 0 ? 1 : -1) * (180 + (i * 23) % 360), opacity: [1, 1, 0] }}
          transition={{ duration: 1.4 + (i % 5) * 0.3, delay: (i % 7) * 0.12, ease: 'linear' }}
        >
          {ITEMS[i % ITEMS.length]}
        </motion.div>
      ))}
    </div>
  )
}
