const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Hermes API config
const HERMES_API_URL = process.env.HERMES_API_URL || 'http://localhost:9119';
const HERMES_API_KEY = process.env.HERMES_API_KEY || '';

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', service: 'J.A.R.V.I.S. Proxy', version: '2.0' });
});

// Chat endpoint - forwards to Hermes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    
    // Forward to Hermes API
    const response = await fetch(`${HERMES_API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HERMES_API_KEY && { 'Authorization': `Bearer ${HERMES_API_KEY}` }),
      },
      body: JSON.stringify({
        message,
        history,
        system_prompt: 'You are J.A.R.V.I.S., Tony Stark\'s AI assistant. Respond concisely and intelligently. You have a dry wit and British mannerisms.',
      }),
    });

    if (!response.ok) {
      // Fallback if Hermes is down
      return res.json({
        reply: `I apologize, sir. The mainframe appears to be offline. I can still process basic commands locally. You said: "${message}"`,
        notification: null,
      });
    }

    const data = await response.json();
    
    // Check if response needs approval
    const needsApproval = message.toLowerCase().includes('delete') || 
                         message.toLowerCase().includes('remove') ||
                         message.toLowerCase().includes('exec') ||
                         message.toLowerCase().includes('run');

    res.json({
      reply: data.reply || data.response || data.message || 'I am J.A.R.V.I.S. at your service.',
      notification: needsApproval ? {
        type: 'approval',
        title: 'Command Authorization Required',
        body: `The command "${message}" requires your approval to proceed.`,
      } : null,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.json({
      reply: 'I apologize, sir. I am experiencing technical difficulties.',
      notification: null,
    });
  }
});

// Notifications endpoint
app.post('/api/notify', (req, res) => {
  const { type, title, body } = req.body;
  // In production, this would push to connected clients via WebSocket
  res.json({ success: true, id: Math.random().toString(36).slice(2) });
});

// Proxy static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../dist'));
}

app.listen(PORT, () => {
  console.log(`J.A.R.V.I.S. proxy server running on port ${PORT}`);
  console.log(`Hermes API: ${HERMES_API_URL}`);
});
