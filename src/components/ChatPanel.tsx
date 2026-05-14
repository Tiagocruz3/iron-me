import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Mic } from 'lucide-react'
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
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-ironme-glow/20 text-ironme-text ml-8'
                  : msg.role === 'system'
                  ? 'bg-ironme-warn/10 text-ironme-warn border border-ironme-warn/30'
                  : 'bg-ironme-panel text-ironme-text mr-8 border border-ironme-border'
              }`}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-ironme-panel border border-ironme-border rounded-2xl px-4 py-3 flex gap-1">
              <span className="w-2 h-2 bg-ironme-glow rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-ironme-glow rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-ironme-glow rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-ironme-border/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a command..."
            className="flex-1 bg-ironme-panel border border-ironme-border rounded-xl px-4 py-3 text-sm text-ironme-text placeholder:text-ironme-text-dim/50 focus:outline-none focus:border-ironme-glow/50"
          />
          <button
            onClick={handleSend}
            className="p-3 rounded-xl bg-ironme-glow/20 text-ironme-glow active:scale-90 transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
