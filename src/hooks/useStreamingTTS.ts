import { useRef, useCallback } from 'react'

export function useStreamingTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaSourceRef = useRef<MediaSource | null>(null)
  const sourceBufferRef = useRef<SourceBuffer | null>(null)

  const speak = useCallback(async (text: string, voiceId?: string) => {
    try {
      // Use MediaSource for true streaming playback
      const mediaSource = new MediaSource()
      mediaSourceRef.current = mediaSource

      const audio = new Audio()
      audioRef.current = audio
      audio.src = URL.createObjectURL(mediaSource)

      await new Promise<void>((resolve, reject) => {
        mediaSource.addEventListener('sourceopen', async () => {
          try {
            const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')
            sourceBufferRef.current = sourceBuffer

            // Fetch streaming audio
            const res = await fetch('/api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, voiceId }),
            })

            if (!res.ok) throw new Error('TTS failed')

            const reader = res.body!.getReader()

            // Read chunks and append to source buffer
            const readChunk = async () => {
              const { done, value } = await reader.read()
              if (done) {
                // Wait for buffer to drain then end stream
                if (sourceBuffer.updating) {
                  await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }))
                }
                if (mediaSource.readyState === 'open') {
                  mediaSource.endOfStream()
                }
                return
              }

              // Wait if buffer is updating
              if (sourceBuffer.updating) {
                await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }))
              }

              sourceBuffer.appendBuffer(value)
              sourceBuffer.addEventListener('updateend', () => {
                readChunk()
              }, { once: true })
            }

            readChunk()
            resolve()
          } catch (err) {
            reject(err)
          }
        }, { once: true })
      })

      await audio.play()
      return audio
    } catch {
      // Fallback: fetch full blob then play
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      await audio.play()
      return audio
    }
  }, [])

  const stop = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (mediaSourceRef.current?.readyState === 'open') {
      try { mediaSourceRef.current.endOfStream() } catch {}
    }
    mediaSourceRef.current = null
    sourceBufferRef.current = null
    speechSynthesis.cancel()
  }, [])

  return { speak, stop }
}
