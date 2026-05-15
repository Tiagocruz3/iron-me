import { useState, useRef, useCallback, useEffect } from 'react'

interface UseLiveCallOptions {
  onTranscript: (text: string) => void
  onSpeakingStart: () => void
  onSpeakingEnd: () => void
}

export function useLiveCall({ onTranscript, onSpeakingStart, onSpeakingEnd }: UseLiveCallOptions) {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)
  const silenceTimeoutRef = useRef<any>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const callActiveRef = useRef(false)

  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'Q7IOSFX7VG3cnK4eU8Z4'

  // Sound effects
  const playSound = useCallback((type: 'start' | 'stop' | 'chime') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (type === 'start') {
        osc.frequency.setValueAtTime(523, ctx.currentTime)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.2)
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.frequency.setValueAtTime(659, ctx.currentTime + 0.1)
        gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.1)
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        osc2.start(ctx.currentTime + 0.1)
        osc2.stop(ctx.currentTime + 0.3)
      } else if (type === 'stop') {
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.15)
      } else if (type === 'chime') {
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.06, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.15)
      }
    } catch {}
  }, [])

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition not supported')
      return
    }

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => {
      isListeningRef.current = true
      setIsListening(true)
      setError(null)
    }

    rec.onresult = (event: any) => {
      let final = ''
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += t
        } else {
          interim += t
        }
      }

      if (final) {
        setTranscript(final)
        onTranscript(final)
      } else {
        setTranscript(interim)
      }

      // Reset silence timer on speech
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      silenceTimeoutRef.current = setTimeout(() => {
        if (isListeningRef.current) {
          rec.stop()
        }
      }, 2000)
    }

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setError('Microphone permission denied')
      } else if (e.error === 'no-speech') {
        if (isListeningRef.current && callActiveRef.current) {
          setTimeout(() => {
            try { rec.start() } catch {}
          }, 500)
        }
      } else if (e.error === 'network') {
        // Auto-restart on network error
        setTimeout(() => {
          if (isListeningRef.current && callActiveRef.current) {
            try { rec.start() } catch {}
          }
        }, 1000)
      }
    }

    rec.onend = () => {
      if (isListeningRef.current && callActiveRef.current) {
        setTimeout(() => {
          try { rec.start() } catch {}
        }, 300)
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = rec
  }, [onTranscript])

  // Start live call
  const startCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()

      setIsCallActive(true)
      callActiveRef.current = true
      isListeningRef.current = true

      playSound('start')

      // Start listening
      setTimeout(() => {
        try { recognitionRef.current?.start() } catch {}
      }, 500)

    } catch {
      setError('Microphone access denied')
    }
  }, [playSound])

  // End call
  const endCall = useCallback(() => {
    isListeningRef.current = false
    callActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsSpeaking(false)

    try { recognitionRef.current?.stop() } catch {}

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
    }

    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    audioContextRef.current?.close()

    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    speechSynthesis.cancel()

    playSound('stop')
  }, [playSound])

  // Speak response (interruptible)
  const speak = useCallback(async (text: string) => {
    if (!callActiveRef.current) return

    setIsSpeaking(true)
    onSpeakingStart()

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      })

      if (res.ok && res.headers.get('content-type')?.includes('audio')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        currentAudioRef.current = audio

        audio.onended = () => {
          setIsSpeaking(false)
          onSpeakingEnd()
          URL.revokeObjectURL(url)
          // Auto-restart listening after speaking
          if (callActiveRef.current) {
            setTimeout(() => {
              try { recognitionRef.current?.start() } catch {}
            }, 300)
          }
        }

        audio.onerror = () => {
          setIsSpeaking(false)
          onSpeakingEnd()
        }

        await audio.play()
        return
      }
      throw new Error('TTS failed')
    } catch {
      const utter = new SpeechSynthesisUtterance(text)
      utter.onend = () => {
        setIsSpeaking(false)
        onSpeakingEnd()
        if (callActiveRef.current) {
          setTimeout(() => {
            try { recognitionRef.current?.start() } catch {}
          }, 300)
        }
      }
      speechSynthesis.speak(utter)
    }
  }, [onSpeakingStart, onSpeakingEnd, voiceId])

  // Interrupt speaking
  const interrupt = useCallback(() => {
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    speechSynthesis.cancel()
    setIsSpeaking(false)
    onSpeakingEnd()

    // Immediately start listening
    setTimeout(() => {
      try { recognitionRef.current?.start() } catch {}
    }, 100)
  }, [onSpeakingEnd])

  return {
    isCallActive,
    isListening,
    isSpeaking,
    transcript,
    error,
    startCall,
    endCall,
    speak,
    interrupt,
  }
}
