export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  const HERMES_API_URL = process.env.HERMES_API_URL
  const HERMES_API_KEY = process.env.HERMES_API_KEY

  if (!HERMES_API_URL) {
    return res.status(200).json({ 
      reply: 'Hermes mainframe URL not configured. Set HERMES_API_URL in Vercel env vars.', 
      notification: null 
    })
  }

  try {
    const response = await fetch(`${HERMES_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HERMES_API_KEY && { 'Authorization': `Bearer ${HERMES_API_KEY}` }),
      },
      body: JSON.stringify({
        model: 'kimi-k2.6',
        messages: [{ role: 'user', content: message }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Hermes error:', response.status, errorText)
      throw new Error(`Hermes ${response.status}`)
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'I am here, sir.'

    const dangerWords = /\b(delete|remove|exec|run\s+sudo|rm\s+-rf|format)\b/i
    const notification = dangerWords.test(message) ? {
      id: Date.now().toString(),
      type: 'approval',
      title: 'Dangerous Command Detected',
      message: `"${message}" — Approve execution?`,
      timestamp: Date.now(),
    } : null

    res.status(200).json({ reply, notification })
  } catch (err) {
    console.error('Chat API error:', err)
    res.status(200).json({ 
      reply: 'Connection to the mainframe is unstable. Ensure your Hermes Agent is running and accessible.', 
      notification: null 
    })
  }
}
