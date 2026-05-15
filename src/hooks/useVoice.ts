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
  const recognitionRef = useRef<any>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

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
    }

    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)

    recognitionRef.current = rec
  }, [onTranscript])

  const startListening = useCallback(() => {
    setTranscript('')
    try {
      recognitionRef.current?.start()
      setIsListening(true)
    } catch {
      try {
        recognitionRef.current?.stop()
        setTimeout(() => {
          recognitionRef.current?.start()
          setIsListening(true)
        }, 100)
      } catch {
        setIsListening(false)
      }
    }
  }, [])

  const stopListening = useCallback(() => {
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
      // Try server-side TTS first (no API key exposed to client)
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

      // Fallback to native speech synthesis
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

  return { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking }
}
