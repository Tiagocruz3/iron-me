import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Cpu, Code, Rocket, Search, CheckCircle, AlertCircle, X, Activity } from 'lucide-react'
import type { Task } from '../types'

interface Props {
  tasks: Task[]
  onDismiss: (id: string) => void
}

const taskIcons: Record<string, React.ReactNode> = {
  code: <Code className="w-4 h-4" />,
  deploy: <Rocket className="w-4 h-4" />,
  research: <Search className="w-4 h-4" />,
  default: <Cpu className="w-4 h-4" />,
}

export function TaskPanel({ tasks, onDismiss }: Props) {
  const activeTasks = tasks.filter(t => t.status === 'running')
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed')

  if (tasks.length === 0) return null

  return (
    <div className="absolute top-16 right-4 z-30 flex flex-col gap-3 max-w-[360px] w-full">
      <AnimatePresence>
        {activeTasks.map(task => (
          <TaskCard key={task.id} task={task} onDismiss={onDismiss} />
        ))}
        {completedTasks.slice(0, 2).map(task => (
          <TaskCard key={task.id} task={task} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function TaskCard({ task, onDismiss }: { task: Task; onDismiss: (id: string) => void }) {
  const isRunning = task.status === 'running'
  const isFailed = task.status === 'failed'
  const isCompleted = task.status === 'completed'
  const currentStep = task.steps.find(s => s.status === 'in_progress')
  const completedSteps = task.steps.filter(s => s.status === 'completed').length

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`bg-jarvis-panel/95 backdrop-blur-xl border rounded-2xl overflow-hidden shadow-2xl ${
        isFailed ? 'border-red-500/40' : 
        isCompleted ? 'border-green-500/40' : 
        'border-cyan-500/40'
      }`}
    >
      {/* Glowing top border for running tasks */}
      {isRunning && (
        <motion.div
          className="h-0.5 bg-cyan-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${
              isFailed ? 'bg-red-500/20 text-red-400' : 
              isCompleted ? 'bg-green-500/20 text-green-400' : 
              'bg-cyan-500/20 text-cyan-400'
            }`}>
              {taskIcons[task.type] || taskIcons.default}
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-white">{task.title}</span>
              {currentStep && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 mt-0.5"
                >
                  <Activity className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                  <span className="text-[10px] text-cyan-400 font-mono">{currentStep.label}</span>
                </motion.div>
              )}
            </div>
          </div>
          <button
            onClick={() => onDismiss(task.id)}
            className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live terminal-style output */}
        {isRunning && currentStep && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-3 bg-black/60 rounded-lg p-2.5 font-mono text-[9px] leading-relaxed overflow-hidden"
          >
            <div className="flex items-center gap-1.5 text-green-400/60 mb-1">
              <Terminal className="w-2.5 h-2.5" />
              <span>jarvis@mainframe:~$</span>
            </div>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-cyan-300/80"
            >
              {currentStep.label}...
            </motion.div>
            <div className="text-white/20 mt-1">
              {'█'.repeat(Math.floor(task.progress / 5))}
              <span className="animate-pulse">▌</span>
            </div>
          </motion.div>
        )}

        {/* Progress bar */}
        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mb-3">
          <motion.div
            className={`h-full rounded-full ${
              isFailed ? 'bg-red-500' : 
              isCompleted ? 'bg-green-500' : 
              'bg-cyan-400'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${task.progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* Steps - compact view */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.steps.slice(0, 4).map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono ${
                step.status === 'in_progress' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                step.status === 'completed' ? 'bg-green-500/10 text-green-400/70' :
                step.status === 'failed' ? 'bg-red-500/10 text-red-400/70' :
                'bg-white/5 text-white/30'
              }`}
            >
              {step.status === 'completed' && <CheckCircle className="w-2.5 h-2.5" />}
              {step.status === 'failed' && <AlertCircle className="w-2.5 h-2.5" />}
              {step.status === 'in_progress' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Activity className="w-2.5 h-2.5" />
                </motion.div>
              )}
              <span>{step.label}</span>
            </motion.div>
          ))}
          {task.steps.length > 4 && (
            <span className="text-[9px] text-white/30">+{task.steps.length - 4}</span>
          )}
        </div>

        {/* Footer stats */}
        <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center text-[9px] text-white/40">
          <div className="flex items-center gap-2">
            <span>{completedSteps}/{task.steps.length} steps</span>
            <span className="text-white/20">|</span>
            <span>{task.progress}%</span>
          </div>
          {isRunning && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-cyan-400 font-mono"
            >
              EXECUTING...
            </motion.span>
          )}
          {isCompleted && (
            <span className="text-green-400 font-mono flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> COMPLETE
            </span>
          )}
          {isFailed && (
            <span className="text-red-400 font-mono flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> FAILED
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
