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
  const recognitionRef = useRef<any>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isListeningRef = useRef(false)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser')
      return
    }

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => {
      console.log('[STT] Recognition started')
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
        console.log('[STT] Final transcript:', final)
        setTranscript(final)
        onTranscript(final)
      } else {
        setTranscript(interim)
      }
    }

    rec.onerror = (e: any) => {
      console.error('[STT] Error:', e.error)
      if (e.error === 'not-allowed') {
        setError('Microphone permission denied. Please allow mic access.')
      } else if (e.error === 'no-speech') {
        setError('No speech detected. Try again.')
      } else {
        setError(`Speech error: ${e.error}`)
      }
      isListeningRef.current = false
      setIsListening(false)
    }

    rec.onend = () => {
      console.log('[STT] Recognition ended. wasListening:', isListeningRef.current)
      // Only auto-restart if we intentionally want to keep listening
      if (isListeningRef.current) {
        try {
          rec.start()
        } catch {
          isListeningRef.current = false
          setIsListening(false)
        }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = rec
  }, [onTranscript])

  const startListening = useCallback(() => {
    console.log('[STT] startListening called')
    setTranscript('')
    setError(null)
    isListeningRef.current = true
    try {
      recognitionRef.current?.start()
    } catch (e: any) {
      console.error('[STT] start failed:', e.message)
      // Already started — do nothing
    }
  }, [])

  const stopListening = useCallback(() => {
    console.log('[STT] stopListening called')
    isListeningRef.current = false
    try {
      recognitionRef.current?.stop()
    } catch {}
    setIsListening(false)
  }, [])

  const speak = useCallback(async (text: string) => {
    const voiceId = 'Q7IOSFX7VG3cnK4eU8Z4'

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
        }
        audio.onerror = () => {
          setIsSpeaking(false)
          onSpeakingEnd()
        }
        await audio.play()
        return
      }

      throw new Error('Server TTS unavailable')
    } catch {
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.1
      utter.pitch = 0.9
      utter.onstart = () => setIsSpeaking(true)
      utter.onend = () => setIsSpeaking(false)
      speechSynthesis.speak(utter)
    }
  }, [onSpeakingStart, onSpeakingEnd])

  const stopSpeaking = useCallback(() => {
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    speechSynthesis.cancel()
    setIsSpeaking(false)
    onSpeakingEnd()
  }, [onSpeakingEnd])

  return { isListening, isSpeaking, transcript, error, startListening, stopListening, speak, stopSpeaking }
}
