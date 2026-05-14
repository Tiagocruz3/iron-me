import { Mic, MessageSquare, Wifi, WifiOff } from 'lucide-react'

interface Props {
  mode: 'voice' | 'chat'
  onToggleMode: () => void
  isConnected: boolean
}

export function StatusBar({ mode, onToggleMode, isConnected }: Props) {
  const now = new Date()
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="h-14 flex items-center justify-between px-4 border-b border-ironme-border/30 bg-ironme-bg/80 backdrop-blur-md z-40">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-ironme-success animate-pulse' : 'bg-ironme-urgent'}`} />
        <span className="text-xs font-medium tracking-wider text-ironme-text-dim">IRON ME</span>
      </div>

      <span className="text-sm font-light text-ironme-text">{time}</span>

      <button
        onClick={onToggleMode}
        className="p-2 rounded-xl bg-ironme-panel border border-ironme-border/50 text-ironme-glow active:scale-90 transition"
      >
        {mode === 'voice' ? <MessageSquare className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
    </div>
  )
}
