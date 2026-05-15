import { WebSocket } from 'ws'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, voiceId: voiceIdFromBody } = req.body
  const voiceId = process.env.ELEVENLABS_VOICE_ID || voiceIdFromBody || 'Q7IOSFX7VG3cnK4eU8Z4'

  if (!text) {
    return res.status(400).json({ error: 'Text required' })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'TTS not configured' })
  }

  try {
    // Use HTTP streaming endpoint for simplicity + speed
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.0,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs error:', errorText)
      return res.status(response.status).send(errorText)
    }

    // Stream audio back to client as it arrives
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Transfer-Encoding', 'chunked')

    const reader = response.body.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }

    res.end()
  } catch (err) {
    console.error('TTS stream error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Voice generation failed' })
    } else {
      res.end()
    }
  }
}
