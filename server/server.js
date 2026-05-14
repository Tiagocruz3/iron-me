import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import dotenv from 'dotenv'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Config
const HERMES_API_URL = process.env.HERMES_API_URL || 'http://localhost:8642'
const HERMES_API_KEY = process.env.HERMES_API_KEY || ''
const PORT = parseInt(process.env.PORT || '3000')
const SESSION_KEY = process.env.SESSION_KEY || 'aisha-default'

// In-memory session store (replace with Redis/DB for production)
const sessions = new Map()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.static(join(__dirname, '../dist')))

// ── Helpers ──────────────────────────────────────────────────────────

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      messages: [],
      createdAt: Date.now(),
      lastActive: Date.now(),
    })
  }
  return sessions.get(sessionId)
}

async function* streamHermesRun(userMessage, session) {
  // Submit run to Hermes
  const runRes = await fetch(`${HERMES_API_URL}/v1/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(HERMES_API_KEY && { 'Authorization': `Bearer ${HERMES_API_KEY}` }),
      'X-Hermes-Session-Key': SESSION_KEY,
      'X-Hermes-Session-Id': session.id,
    },
    body: JSON.stringify({
      input: userMessage,
      model: 'hermes-agent',
      stream: true,
    }),
  })

  if (!runRes.ok) {
    throw new Error(`Hermes run submission failed: ${runRes.status}`)
  }

  const { run_id } = await runRes.json()
  yield { type: 'run_started', run_id }

  // Stream events via SSE
  const eventsRes = await fetch(`${HERMES_API_URL}/v1/runs/${run_id}/events`, {
    headers: {
      ...(HERMES_API_KEY && { 'Authorization': `Bearer ${HERMES_API_KEY}` }),
      'X-Hermes-Session-Key': SESSION_KEY,
      'X-Hermes-Session-Id': session.id,
    },
  })

  if (!eventsRes.ok) {
    throw new Error(`Hermes events stream failed: ${eventsRes.status}`)
  }

  const reader = eventsRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          yield { type: 'done' }
          return
        }
        try {
          const event = JSON.parse(data)
          yield event
        } catch {
          yield { type: 'raw', data }
        }
      }
    }
  }
}

// ── HTTP Routes ──────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', aisha: true, hermes: HERMES_API_URL })
})

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body
  const session = getSession(sessionId)
  session.lastActive = Date.now()

  // Add user message to history
  session.messages.push({ role: 'user', content: message, timestamp: Date.now() })

  try {
    // Use non-streaming chat completions for simple responses
    const response = await fetch(`${HERMES_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HERMES_API_KEY && { 'Authorization': `Bearer ${HERMES_API_KEY}` }),
        'X-Hermes-Session-Key': SESSION_KEY,
        'X-Hermes-Session-Id': session.id,
      },
      body: JSON.stringify({
        model: 'hermes-agent',
        messages: [
          { role: 'system', content: 'You are AISHA, an advanced AI assistant. Be concise, helpful, and professional. You have access to tools and can execute commands on behalf of the user.' },
          ...session.messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
        ],
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status}`)
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'I am here, sir.'

    session.messages.push({ role: 'assistant', content: reply, timestamp: Date.now() })

    res.json({
      reply,
      sessionId: session.id,
      messageCount: session.messages.length,
    })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: 'Connection to mainframe unstable', details: err.message })
  }
})

app.post('/api/chat/stream', async (req, res) => {
  const { message, sessionId = 'default' } = req.body
  const session = getSession(sessionId)
  session.lastActive = Date.now()
  session.messages.push({ role: 'user', content: message, timestamp: Date.now() })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const runRes = await fetch(`${HERMES_API_URL}/v1/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HERMES_API_KEY && { 'Authorization': `Bearer ${HERMES_API_KEY}` }),
        'X-Hermes-Session-Key': SESSION_KEY,
        'X-Hermes-Session-Id': session.id,
      },
      body: JSON.stringify({
        input: message,
        model: 'hermes-agent',
        stream: true,
      }),
    })

    const { run_id } = await runRes.json()
    res.write(`data: ${JSON.stringify({ type: 'run_started', run_id })}\n\n`)

    const eventsRes = await fetch(`${HERMES_API_URL}/v1/runs/${run_id}/events`, {
      headers: {
        ...(HERMES_API_KEY && { 'Authorization': `Bearer ${HERMES_API_KEY}` }),
        'X-Hermes-Session-Key': SESSION_KEY,
        'X-Hermes-Session-Id': session.id,
      },
    })

    const reader = eventsRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullReply = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            session.messages.push({ role: 'assistant', content: fullReply, timestamp: Date.now() })
            res.write(`data: ${JSON.stringify({ type: 'done', fullReply })}\n\n`)
            res.end()
            return
          }
          try {
            const event = JSON.parse(data)
            if (event.type === 'agent_response' && event.data?.content) {
              fullReply += event.data.content
            }
            res.write(`data: ${JSON.stringify(event)}\n\n`)
          } catch {
            res.write(`data: ${JSON.stringify({ type: 'raw', data })}\n\n`)
          }
        }
      }
    }

    res.end()
  } catch (err) {
    console.error('Stream error:', err)
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
    res.end()
  }
})

app.get('/api/session/:id', (req, res) => {
  const session = sessions.get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  res.json(session)
})

app.get('/api/sessions', (_req, res) => {
  const list = Array.from(sessions.values()).map(s => ({
    id: s.id,
    messageCount: s.messages.length,
    lastActive: s.lastActive,
    createdAt: s.createdAt,
  }))
  res.json(list)
})

// ── WebSocket ────────────────────────────────────────────────────────

wss.on('connection', (ws, req) => {
  console.log('WS client connected from', req.socket.remoteAddress)
  const sessionId = `ws-${Date.now()}`
  const session = getSession(sessionId)

  ws.send(JSON.stringify({ type: 'connected', sessionId }))

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString())

      if (msg.type === 'chat') {
        const { text } = msg
        session.messages.push({ role: 'user', content: text, timestamp: Date.now() })

        ws.send(JSON.stringify({ type: 'thinking', run_id: null }))

        try {
          const response = await fetch(`${HERMES_API_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(HERMES_API_KEY && { 'Authorization': `Bearer ${HERMES_API_KEY}` }),
              'X-Hermes-Session-Key': SESSION_KEY,
              'X-Hermes-Session-Id': session.id,
            },
            body: JSON.stringify({
              model: 'hermes-agent',
              messages: [
                { role: 'system', content: 'You are AISHA, an advanced AI assistant. Be concise, helpful, and professional.' },
                ...session.messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
              ],
              stream: false,
            }),
          })

          const data = await response.json()
          const reply = data.choices?.[0]?.message?.content || 'I am here, sir.'
          session.messages.push({ role: 'assistant', content: reply, timestamp: Date.now() })

          ws.send(JSON.stringify({ type: 'response', text: reply, sessionId }))
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }))
        }
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
    }
  })

  ws.on('close', () => {
    console.log('WS client disconnected')
  })
})

// ── Start ────────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AISHA Server running on http://0.0.0.0:${PORT}`)
  console.log(`Hermes API: ${HERMES_API_URL}`)
  console.log(`WebSocket: ws://0.0.0.0:${PORT}/ws`)
})
