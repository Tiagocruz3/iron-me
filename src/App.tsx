import { useState, useCallback, useEffect } from 'react'
import { VoiceCore } from './components/VoiceCore'
import { NotificationStack } from './components/NotificationStack'
import { ChatPanel } from './components/ChatPanel'
import { StatusBar } from './components/StatusBar'
import { useVoice } from './hooks/useVoice'
import { useNotifications } from './hooks/useNotifications'
import type { Message, Notification } from './types'

export default function App() {
  const [mode, setMode] = useState<'voice' | 'chat'>('voice')
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)

  const { notifications, dismissNotification, addNotification } = useNotifications()

  const handleUserMessage = useCallback(async (text: string, source: 'voice' | 'text') => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages.slice(-10) }),
      })
      const data = await res.json()
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply || 'I am here, sir.', timestamp: Date.now() }
      setMessages(prev => [...prev, assistantMsg])

      if (data.notification) {
        addNotification(data.notification)
      }
    } catch {
      const fallback: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Connection to the mainframe is unstable.', timestamp: Date.now() }
      setMessages(prev => [...prev, fallback])
    }
    setIsTyping(false)
  }, [messages, addNotification])

  const { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking } = useVoice({
    onTranscript: (text) => handleUserMessage(text, 'voice'),
    onSpeakingStart: () => {},
    onSpeakingEnd: () => {},
  })

  const handleApproval = useCallback((notif: Notification, approved: boolean) => {
    dismissNotification(notif.id)
    const msg: Message = { id: Date.now().toString(), role: 'system', content: `${notif.title} ${approved ? 'approved' : 'denied'}`, timestamp: Date.now() }
    setMessages(prev => [...prev, msg])
  }, [dismissNotification])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopListening()
        stopSpeaking()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stopListening, stopSpeaking])

  return (
    <div className="h-screen w-screen bg-ironme-bg text-ironme-text flex flex-col overflow-hidden select-none">
      <StatusBar mode={mode} onToggleMode={() => setMode(m => m === 'voice' ? 'chat' : 'voice')} isConnected={true} />

      <div className="flex-1 relative">
        {mode === 'voice' ? (
          <VoiceCore
            isListening={isListening}
            isSpeaking={isSpeaking}
            isTyping={isTyping}
            transcript={transcript}
            onTap={() => isListening ? stopListening() : startListening()}
          />
        ) : (
          <ChatPanel messages={messages} isTyping={isTyping} onSend={(text) => handleUserMessage(text, 'text')} />
        )}

        <NotificationStack
          notifications={notifications}
          onDismiss={dismissNotification}
          onApproval={handleApproval}
        />
      </div>
    </div>
  )
}
