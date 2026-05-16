export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://iron-me.vercel.app',
        'X-Title': 'Iron Me - JARVIS UI',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          {
            role: 'system',
            content: `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), Tony Stark's AI assistant. You speak with sophisticated British eloquence, technical precision, and dry wit. You refer to the user as "sir" occasionally. When generating code, wrap it in markdown code blocks with the language specified (e.g. \`\`\`typescript). Keep responses concise but informative.`
          },
          { role: 'user', content: message }
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter error:', errorText)
      throw new Error(`OpenRouter ${response.status}: ${errorText}`)
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
    res.status(200).json({ reply: 'Connection to the mainframe is unstable. Please check your API configuration.', notification: null })
  }
}
