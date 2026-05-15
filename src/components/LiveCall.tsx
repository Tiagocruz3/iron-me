import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Volume2, PhoneOff } from 'lucide-react'

interface Props {
  isCallActive: boolean
  isListening: boolean
  isSpeaking: boolean
  onEndCall: () => void
}

export function LiveCall({ isCallActive, isListening, isSpeaking, onEndCall }: Props) {
  return (
    <AnimatePresence>
      {isCallActive && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4"
        >
          {/* Call status */}
          <div className="flex items-center gap-3 px-6 py-3 bg-black/60 backdrop-blur-xl border border-cyan-500/30 rounded-full">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'}`} />
              <Mic className={`w-4 h-4 ${isListening ? 'text-cyan-400' : 'text-white/40'}`} />
            </div>
            
            <div className="w-px h-4 bg-white/20" />
            
            <div className="flex items-center gap-2">
              <Volume2 className={`w-4 h-4 ${isSpeaking ? 'text-green-400' : 'text-white/40'}`} />
              <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
            </div>

            <div className="w-px h-4 bg-white/20" />
            
            <span className="text-xs font-mono text-cyan-400">
              {isListening ? 'LISTENING' : isSpeaking ? 'SPEAKING' : 'IDLE'}
            </span>
          </div>

          {/* End call */}
          <button
            onClick={onEndCall}
            className="p-3 bg-red-500/20 border border-red-400 rounded-full text-red-400 hover:bg-red-500/30 transition active:scale-90"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
