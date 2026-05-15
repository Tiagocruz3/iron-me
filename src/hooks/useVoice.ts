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
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<AudioBuffer[]>([])
  const isPlayingRef = useRef(false)

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
      // Already started — restart it
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
    } catch {
      // Already stopped
    }
    setIsListening(false)
  }, [])

  const playNext = useCallback((ctx: AudioContext) => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return
    isPlayingRef.current = true
    const buffer = audioQueueRef.current.shift()!
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => {
      isPlayingRef.current = false
      playNext(ctx)
    }
    source.start()
  }, [])

  const speak = useCallback(async (text: string) => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'Q7IOSFX7VG3cnK4eU8Z4'
    if (!apiKey) {
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.1
      utter.pitch = 0.9
      utter.onstart = () => setIsSpeaking(true)
      utter.onend = () => setIsSpeaking(false)
      speechSynthesis.speak(utter)
      return
    }

    setIsSpeaking(true)
    onSpeakingStart()

    try {
      const ws = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_flash_v2_5`)
      wsRef.current = ws

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve()
        ws.onerror = reject
      })

      ws.send(JSON.stringify({
        text: ' ',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        xi_api_key: apiKey,
      }))

      ws.send(JSON.stringify({ text: text + ' ' }))
      ws.send(JSON.stringify({ text: '' }))

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data)
        if (data.audio) {
          const binary = atob(data.audio)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const buffer = await ctx.decodeAudioData(bytes.buffer)
          audioQueueRef.current.push(buffer)
          playNext(ctx)
        }
        if (data.isFinal) {
          setIsSpeaking(false)
          onSpeakingEnd()
        }
      }

      ws.onerror = () => {
        setIsSpeaking(false)
        onSpeakingEnd()
      }
    } catch {
      setIsSpeaking(false)
      onSpeakingEnd()
    }
  }, [onSpeakingStart, onSpeakingEnd, playNext])

  const stopSpeaking = useCallback(() => {
    wsRef.current?.close()
    audioQueueRef.current = []
    isPlayingRef.current = false
    setIsSpeaking(false)
    onSpeakingEnd()
  }, [onSpeakingEnd])

  return { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking }
}
