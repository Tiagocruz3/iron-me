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
    <div className="h-14 flex items-center justify-between px-4 border-b border-aisha-border/30 bg-aisha-bg/80 backdrop-blur-md z-40">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-aisha-success animate-pulse' : 'bg-aisha-urgent'}`} />
        <span className="text-xs font-medium tracking-wider text-aisha-text-dim">AISHA</span>
      </div>

      <span className="text-sm font-light text-aisha-text">{time}</span>

      <button
        onClick={onToggleMode}
        className="p-2 rounded-xl bg-aisha-panel border border-aisha-border/50 text-aisha-glow active:scale-90 transition"
      >
        {mode === 'voice' ? <MessageSquare className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
    </div>
  )
}
