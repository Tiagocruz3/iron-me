import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Info, CheckCircle, Zap } from 'lucide-react'
import type { Notification } from '../types'

interface Props {
  notifications: Notification[]
  onDismiss: (id: string) => void
  onApproval: (notif: Notification, approved: boolean) => void
}

const icons = {
  approval: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  urgent: Zap,
}

const colors = {
  approval: 'border-ironme-success/50 text-ironme-success',
  info: 'border-ironme-glow/50 text-ironme-glow',
  warning: 'border-ironme-warn/50 text-ironme-warn',
  urgent: 'border-ironme-urgent/50 text-ironme-urgent',
}

export function NotificationStack({ notifications, onDismiss, onApproval }: Props) {
  return (
    <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 z-50 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => {
          const Icon = icons[notif.type]
          const colorClass = colors[notif.type]
          return (
            <motion.div
              key={notif.id}
              initial={{ y: 100, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.9 }}
              className={`pointer-events-auto bg-ironme-panel/95 backdrop-blur-xl border ${colorClass} rounded-2xl p-4 shadow-2xl`}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-6 h-6 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{notif.title}</h3>
                  <p className="text-xs text-ironme-text-dim mt-1">{notif.body}</p>

                  {notif.type === 'approval' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => onApproval(notif, false)}
                        className="flex-1 py-2.5 rounded-xl bg-ironme-urgent/20 text-ironme-urgent text-sm font-medium active:scale-95 transition"
                      >
                        Deny
                      </button>
                      <button
                        onClick={() => onApproval(notif, true)}
                        className="flex-1 py-2.5 rounded-xl bg-ironme-success/20 text-ironme-success text-sm font-medium active:scale-95 transition"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDismiss(notif.id)}
                  className="p-1 rounded-lg hover:bg-white/10 active:scale-90 transition"
                >
                  <X className="w-4 h-4 text-ironme-text-dim" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
