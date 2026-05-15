import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface TaskLog {
  type: 'stdout' | 'stderr'
  line: string
  time: number
}

interface Task {
  id: string
  status: 'running' | 'completed' | 'failed'
  logs: TaskLog[]
  currentStep: string
  command: string
}

interface Props {
  tasks: Task[]
  onDismiss: (id: string) => void
}

export function TaskStreamPanel({ tasks, onDismiss }: Props) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [tasks])

  if (tasks.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 right-4 w-[480px] max-h-[70vh] flex flex-col gap-2 z-30"
    >
      {tasks.map((task) => (
        <motion.div
          key={task.id}
          layout
          className="bg-jarvis-panel/95 backdrop-blur-xl border border-jarvis-border/50 rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-jarvis-border/30">
            <div className="flex items-center gap-3">
              <Terminal className="w-4 h-4 text-jarvis-cyan" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-jarvis-text">{task.command}</span>
                <span className="text-xs text-jarvis-cyan font-mono">{task.currentStep}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.status === 'running' && (
                <div className="w-2 h-2 rounded-full bg-jarvis-cyan animate-pulse" />
              )}
              {task.status === 'completed' && (
                <div className="w-2 h-2 rounded-full bg-jarvis-success" />
              )}
              {task.status === 'failed' && (
                <div className="w-2 h-2 rounded-full bg-jarvis-urgent" />
              )}
              <button
                onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                className="p-1 text-jarvis-text-dim hover:text-jarvis-text transition"
              >
                {expandedTask === task.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onDismiss(task.id)}
                className="p-1 text-jarvis-text-dim hover:text-jarvis-urgent transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Logs */}
          <AnimatePresence>
            {expandedTask === task.id && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 300 }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="h-[300px] overflow-y-auto p-4 font-mono text-xs bg-black/50">
                  {task.logs.map((log, i) => (
                    <div
                      key={i}
                      className={`whitespace-pre-wrap break-all ${
                        log.type === 'stderr' ? 'text-jarvis-urgent' : 'text-jarvis-text-dim'
                      }`}
                    >
                      {log.line}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar for running tasks */}
          {task.status === 'running' && (
            <div className="h-0.5 bg-jarvis-border/30">
              <motion.div
                className="h-full bg-jarvis-cyan"
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}
