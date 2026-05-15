import { useState, useCallback, useEffect, useRef } from 'react'
import { VoiceCore } from './components/VoiceCore'
import { NotificationStack } from './components/NotificationStack'
import { ChatPanel } from './components/ChatPanel'
import { StatusBar } from './components/StatusBar'
import { TaskPanel } from './components/TaskPanel'
import { ParticleBackground } from './components/ParticleBackground'
import { ARMode } from './components/ARMode'
import { useVoice } from './hooks/useVoice'
import { useWakeWord } from './hooks/useWakeWord'
import { useNotifications } from './hooks/useNotifications'
import { useTasks } from './hooks/useTasks'
import type { Message, Notification } from './types'

export default function App() {
  const [mode, setMode] = useState<'voice' | 'chat' | 'ar'>('voice')
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [conversationMode, setConversationMode] = useState(false)
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false)
  const [pushToTalk, setPushToTalk] = useState(false)

  const { notifications, dismissNotification, addNotification } = useNotifications()
  const { tasks, createTask, updateTaskStep, completeTask, dismissTask } = useTasks()
  const speakRef = useRef<((text: string) => Promise<void>)>(async () => {})

  const { isListening, isSpeaking, isProcessingSTT, transcript, error, useManualInput, setUseManualInput, startListening, stopListening, speak, stopSpeaking, playSound } = useVoice({
    onTranscript: (text) => handleUserMessage(text, 'voice'),
    onSpeakingStart: () => {},
    onSpeakingEnd: () => {},
  })

  speakRef.current = speak

  // Wake word detection
  useWakeWord({
    wakeWord: 'hey jarvis',
    onWake: () => {
      playSound('chime')
      startListening()
    },
    enabled: wakeWordEnabled && !isListening && !isSpeaking,
  })

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setPushToTalk(true)
        if (!isListening && !isSpeaking) {
          startListening()
        }
      }
      if (e.key === 'Escape') {
        stopListening()
        stopSpeaking()
      }
      if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault()
        setWakeWordEnabled(w => !w)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setPushToTalk(false)
        if (isListening) {
          stopListening()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isListening, isSpeaking, startListening, stopListening, stopSpeaking])

  const detectTaskType = (text: string): string => {
    const lower = text.toLowerCase()
    if (lower.includes('create') || lower.includes('build') || lower.includes('code') || lower.includes('make') || lower.includes('write')) return 'code'
    if (lower.includes('deploy') || lower.includes('push') || lower.includes('publish')) return 'deploy'
    if (lower.includes('research') || lower.includes('find') || lower.includes('search') || lower.includes('look up')) return 'research'
    return 'default'
  }

  const handleUserMessage = useCallback(async (text: string, source: 'voice' | 'text') => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    const taskType = detectTaskType(text)
    const taskId = createTask(taskType, text)

    const stepInterval = setInterval(() => {
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        const currentStep = task.steps.findIndex(s => s.status === 'in_progress')
        if (currentStep >= 0 && currentStep < task.steps.length - 1) {
          updateTaskStep(taskId, currentStep, 'completed')
        }
      }
    }, 1500)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply || 'I am here, sir.', timestamp: Date.now() }
      setMessages(prev => [...prev, assistantMsg])

      clearInterval(stepInterval)
      completeTask(taskId, true)

      if (source === 'voice' || mode === 'voice') {
        await speakRef.current(data.reply || 'I am here, sir.')
      }

      if (data.notification) {
        addNotification(data.notification)
      }
    } catch {
      clearInterval(stepInterval)
      completeTask(taskId, false)
      const fallback: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Connection to the mainframe is unstable.', timestamp: Date.now() }
      setMessages(prev => [...prev, fallback])
      if (source === 'voice' || mode === 'voice') {
        await speakRef.current('Connection to the mainframe is unstable.')
      }
    }
    setIsTyping(false)
  }, [mode, addNotification, createTask, updateTaskStep, completeTask, tasks])

  // Auto-turn
  useEffect(() => {
    if (conversationMode && !isSpeaking && !isTyping && !isListening && mode === 'voice') {
      const timeout = setTimeout(() => startListening(), 800)
      return () => clearTimeout(timeout)
    }
  }, [isSpeaking, isTyping, isListening, conversationMode, mode, startListening])

  const handleInterrupt = useCallback(() => {
    stopSpeaking()
    setTimeout(() => startListening(), 200)
  }, [stopSpeaking, startListening])

  const handleApproval = useCallback((notif: Notification, approved: boolean) => {
    dismissNotification(notif.id)
    const msg: Message = { id: Date.now().toString(), role: 'system', content: `${notif.title} ${approved ? 'approved' : 'denied'}`, timestamp: Date.now() }
    setMessages(prev => [...prev, msg])
  }, [dismissNotification])

  return (
    <div className="h-screen w-screen bg-jarvis-bg text-jarvis-text flex flex-col overflow-hidden select-none relative">
      <ParticleBackground />
      
      <StatusBar 
        mode={mode} 
        onToggleMode={() => setMode(m => m === 'voice' ? 'chat' : 'voice')} 
        isConnected={true}
        conversationMode={conversationMode}
        onToggleConversation={() => setConversationMode(c => !c)}
        wakeWordEnabled={wakeWordEnabled}
        onToggleWakeWord={() => setWakeWordEnabled(w => !w)}
      />

      <div className="flex-1 relative z-10">
        {mode === 'ar' ? (
          <ARMode onBack={() => setMode('voice')} />
        ) : mode === 'voice' ? (
          <VoiceCore
            isListening={isListening}
            isSpeaking={isSpeaking}
            isTyping={isTyping}
            isProcessingSTT={isProcessingSTT}
            transcript={transcript}
            error={error}
            useManualInput={useManualInput}
            setUseManualInput={setUseManualInput}
            onManualSubmit={(text) => handleUserMessage(text, 'text')}
            conversationMode={conversationMode}
            onInterrupt={handleInterrupt}
            messages={messages}
            pushToTalk={pushToTalk}
            onTap={() => isListening ? stopListening() : startListening()}
          />
        ) : (
          <ChatPanel messages={messages} isTyping={isTyping} onSend={(text) => handleUserMessage(text, 'text')} />
        )}

        <TaskPanel tasks={tasks} onDismiss={dismissTask} />

        <NotificationStack
          notifications={notifications}
          onDismiss={dismissNotification}
          onApproval={handleApproval}
        />
      </div>
    </div>
  )
}
