import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceOptions {
  onTranscript: (text: string) => void
  onSpeakingStart: () => void
  onSpeakingEnd: () => void
}

export function useVoice({ onTranscript, onSpeakingStart, onSpeakingEnd }: UseVoiceOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [useManualInput, setUseManualInput] = useState(false)
  const [isProcessingSTT, setIsProcessingSTT] = useState(false)
  const recognitionRef = useRef<any>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isListeningRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<any>(null)

  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'Q7IOSFX7VG3cnK4e8U4Z'

  const hasNativeSTT = typeof window !== 'undefined' && 
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  // Sound effects using Web Audio API
  const playSound = useCallback((type: 'start' | 'stop' | 'error' | 'chime') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (type === 'start') {
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.1)
      } else if (type === 'stop') {
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.15)
      } else if (type === 'error') {
        osc.frequency.setValueAtTime(150, ctx.currentTime)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        osc.type = 'sawtooth'
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.2)
      } else if (type === 'chime') {
        osc.frequency.setValueAtTime(523, ctx.currentTime)
        gain.gain.setValueAtTime(0.05, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.3)
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.frequency.setValueAtTime(659, ctx.currentTime + 0.1)
        gain2.gain.setValueAtTime(0.05, ctx.currentTime + 0.1)
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        osc2.start(ctx.currentTime + 0.1)
        osc2.stop(ctx.currentTime + 0.4)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!hasNativeSTT) {
      setError('Safari detected. Using server-side STT or manual input.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => {
      isListeningRef.current = true
      setIsListening(true)
      setError(null)
      playSound('start')
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
        playSound('stop')
        // Auto-stop listening after final result
        isListeningRef.current = false
        try { rec.stop() } catch {}
      } else {
        setTranscript(interim)
      }
    }

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setError('Microphone permission denied.')
        playSound('error')
      } else if (e.error === 'no-speech') {
        setError('No speech detected.')
      } else if (e.error === 'aborted') {
        // User stopped, ignore
      } else if (e.error === 'network') {
        setError('STT network error. Retrying...')
        // Auto-restart on network error
        setTimeout(() => {
          if (isListeningRef.current) {
            try { rec.start() } catch {}
          }
        }, 1000)
        return
      } else {
        setError(`STT error: ${e.error}`)
      }
      isListeningRef.current = false
      setIsListening(false)
    }

    rec.onend = () => {
      if (isListeningRef.current) {
        try { rec.start() } catch { isListeningRef.current = false; setIsListening(false) }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = rec
  }, [onTranscript, hasNativeSTT, playSound])

  // Server-side STT via Deepgram
  const startServerSTT = useCallback(async () => {
    try {
      setIsProcessingSTT(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        setIsProcessingSTT(true)
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.readAsDataURL(audioBlob)
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1]
          try {
            const res = await fetch('/api/stt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64 }),
            })
            if (!res.ok) throw new Error('STT server error')
            const data = await res.json()
            if (data.transcript) {
              setTranscript(data.transcript)
              onTranscript(data.transcript)
              playSound('chime')
            }
          } catch (err: any) {
            setError(err.message || 'STT failed. Try manual input.')
            playSound('error')
          }
          setIsProcessingSTT(false)
          setIsListening(false)
        }
      }

      mediaRecorder.start()
      setIsListening(true)
      setError(null)
      playSound('start')

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          stream.getTracks().forEach(t => t.stop())
        }
      }, 5000)
    } catch {
      setError('Microphone access denied.')
      setIsListening(false)
      setIsProcessingSTT(false)
      playSound('error')
    }
  }, [onTranscript, playSound])

  const startListening = useCallback(() => {
    setTranscript('')
    setError(null)

    if (hasNativeSTT) {
      isListeningRef.current = true
      try {
        recognitionRef.current?.start()
      } catch {}
    } else {
      startServerSTT()
    }
  }, [hasNativeSTT, startServerSTT])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    try {
      recognitionRef.current?.stop()
    } catch {}

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    setIsListening(false)
    playSound('stop')
  }, [playSound])
  // Streaming TTS - play chunks as they arrive
  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true)
    onSpeakingStart()

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        currentAudioRef.current = audio
        audio.onended = () => { 
          setIsSpeaking(false); 
          onSpeakingEnd(); 
          URL.revokeObjectURL(url) 
        }
        audio.onerror = () => { 
          setIsSpeaking(false); 
          onSpeakingEnd() 
        }
        await audio.play()
        return
      }
      throw new Error('TTS failed')
    } catch {
      // Fallback to native speech synthesis
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.1
      utter.pitch = 0.9
      utter.onstart = () => setIsSpeaking(true)
      utter.onend = () => setIsSpeaking(false)
      speechSynthesis.speak(utter)
    }
  }, [onSpeakingStart, onSpeakingEnd, voiceId])
  const stopSpeaking = useCallback(() => {
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    speechSynthesis.cancel()
    setIsSpeaking(false)
    onSpeakingEnd()
  }, [onSpeakingEnd])

  return { 
    isListening, 
    isSpeaking, 
    isProcessingSTT,
    transcript, 
    error,
    useManualInput,
    setUseManualInput,
    startListening, 
    stopListening, 
    speak, 
    stopSpeaking,
    playSound
  }
}
