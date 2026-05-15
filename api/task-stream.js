import { spawn } from 'child_process'
import { createReadStream, watch } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'

// Task execution with real-time streaming
const activeTasks = new Map()

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { command, taskId, cwd } = req.body
    
    // Start task
    const task = {
      id: taskId,
      command,
      cwd: cwd || process.cwd(),
      status: 'running',
      logs: [],
      startTime: Date.now(),
      process: null,
    }
    
    activeTasks.set(taskId, task)
    
    // Spawn process
    const [cmd, ...args] = command.split(' ')
    const proc = spawn(cmd, args, {
      cwd: task.cwd,
      env: { ...process.env, FORCE_COLOR: '1' },
      shell: true,
    })
    
    task.process = proc
    
    // Stream stdout
    proc.stdout.on('data', (data) => {
      const line = data.toString()
      task.logs.push({ type: 'stdout', line, time: Date.now() })
      
      // Parse progress indicators
      if (line.includes('Creating') || line.includes('Writing')) {
        task.currentStep = 'Generating code...'
      } else if (line.includes('Building') || line.includes('Compiling')) {
        task.currentStep = 'Building project...'
      } else if (line.includes('Installing') || line.includes('npm')) {
        task.currentStep = 'Installing dependencies...'
      } else if (line.includes('Test') || line.includes('test')) {
        task.currentStep = 'Running tests...'
      }
    })
    
    // Stream stderr
    proc.stderr.on('data', (data) => {
      task.logs.push({ type: 'stderr', line: data.toString(), time: Date.now() })
    })
    
    proc.on('close', (code) => {
      task.status = code === 0 ? 'completed' : 'failed'
      task.exitCode = code
      task.endTime = Date.now()
    })
    
    res.status(200).json({ taskId, status: 'started' })
    
  } else if (req.method === 'GET') {
    // SSE endpoint for streaming
    const { taskId } = req.query
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
    
    const task = activeTasks.get(taskId)
    if (!task) {
      res.write(`data: ${JSON.stringify({ error: 'Task not found' })}\n\n`)
      res.end()
      return
    }
    
    // Send initial state
    res.write(`data: ${JSON.stringify({ type: 'init', task })}\n\n`)
    
    // Stream new logs
    let lastLogIndex = task.logs.length
    const interval = setInterval(() => {
      if (task.logs.length > lastLogIndex) {
        const newLogs = task.logs.slice(lastLogIndex)
        res.write(`data: ${JSON.stringify({ type: 'logs', logs: newLogs, step: task.currentStep })}\n\n`)
        lastLogIndex = task.logs.length
      }
      
      if (task.status !== 'running') {
        res.write(`data: ${JSON.stringify({ type: 'complete', status: task.status, exitCode: task.exitCode })}\n\n`)
        clearInterval(interval)
        res.end()
      }
    }, 100)
    
    req.on('close', () => {
      clearInterval(interval)
    })
  }
}
