import { useState, useRef, useCallback, useEffect } from 'react'

interface TaskLog {
  type: 'stdout' | 'stderr'
  line: string
  time: number
}

interface TaskStream {
  id: string
  status: 'running' | 'completed' | 'failed'
  logs: TaskLog[]
  currentStep: string
  command: string
}

export function useTaskStream() {
  const [tasks, setTasks] = useState<TaskStream[]>([])
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map())

  const startTask = useCallback(async (command: string, description: string) => {
    const taskId = `task-${Date.now()}`
    
    // Add task locally
    setTasks(prev => [...prev, {
      id: taskId,
      status: 'running',
      logs: [{ type: 'stdout', line: `$ ${command}`, time: Date.now() }],
      currentStep: 'Starting...',
      command: description,
    }])

    // Start on server
    await fetch('/api/task-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, taskId }),
    })

    // Connect to SSE
    const es = new EventSource(`/api/task-stream?taskId=${taskId}`)
    eventSourcesRef.current.set(taskId, es)

    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'logs') {
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              logs: [...t.logs, ...data.logs],
              currentStep: data.step || t.currentStep,
            }
          }
          return t
        }))
      } else if (data.type === 'complete') {
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              status: data.status,
              logs: [...t.logs, { type: 'stdout', line: `\n✓ Exit code: ${data.exitCode}`, time: Date.now() }],
            }
          }
          return t
        }))
        es.close()
        eventSourcesRef.current.delete(taskId)
      }
    }

    es.onerror = () => {
      es.close()
      eventSourcesRef.current.delete(taskId)
    }

    return taskId
  }, [])

  const dismissTask = useCallback((taskId: string) => {
    const es = eventSourcesRef.current.get(taskId)
    if (es) {
      es.close()
      eventSourcesRef.current.delete(taskId)
    }
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [])

  useEffect(() => {
    return () => {
      eventSourcesRef.current.forEach(es => es.close())
      eventSourcesRef.current.clear()
    }
  }, [])

  return { tasks, startTask, dismissTask }
}
