import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Mic, Plus, Square, Sparkles } from 'lucide-react'
import type { Message } from '../types'

interface Props {
  messages: Message[]
  isTyping: boolean
  onSend: (text: string) => void
}

export function ChatPanel({ messages, isTyping, onSend }: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto w-full relative">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
        {messages.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-jarvis-text-dim/30"
          >
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-cyan-400" />
            </div>
            <span className="text-3xl font-light tracking-[0.2em] mb-2 text-white/80">J.A.R.V.I.S.</span>
            <span className="text-sm tracking-wider text-white/40">How may I assist you today?</span>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                  <span className="text-[10px] font-bold text-cyan-400">J</span>
                </div>
              )}
              
              <div
                className={`max-w-[82%] px-4 py-3 text-[15px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-500/15 text-white rounded-3xl rounded-tr-md ml-8 border border-cyan-500/20'
                    : msg.role === 'system'
                    ? 'bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30'
                    : 'bg-white/5 text-white/90 rounded-3xl rounded-tl-md mr-8 border border-white/10'
                }`}
              >
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center ml-2 mt-1 flex-shrink-0">
                  <span className="text-[10px] font-bold text-white/60">U</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mr-2 flex-shrink-0">
                <span className="text-[10px] font-bold text-cyan-400">J</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-3xl rounded-tl-md px-4 py-3 flex gap-1.5 items-center">
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  className="w-1.5 h-1.5 bg-cyan-400 rounded-full" 
                />
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                  className="w-1.5 h-1.5 bg-cyan-400 rounded-full" 
                />
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                  className="w-1.5 h-1.5 bg-cyan-400 rounded-full" 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Bar */}
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-2 focus-within:border-cyan-500/40 transition-colors">
          <button className="p-2 rounded-full text-white/40 hover:text-white/70 hover:bg-white/10 transition">
            <Plus className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask J.A.R.V.I.S."
            className="flex-1 bg-transparent text-white text-[15px] placeholder:text-white/30 focus:outline-none py-2"
          />
          
          {input.trim() ? (
            <button
              onClick={handleSend}
              className="p-2.5 rounded-full bg-cyan-500 text-black active:scale-90 transition hover:bg-cyan-400"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button className="p-2.5 rounded-full text-white/40 hover:text-white/70 hover:bg-white/10 transition">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="text-center mt-2">
          <span className="text-[10px] text-white/20 tracking-wider">J.A.R.V.I.S. can make mistakes. Consider checking important information.</span>
        </div>
      </div>
    </div>
  )
}
