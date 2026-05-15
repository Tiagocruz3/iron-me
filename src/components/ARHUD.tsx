import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, Crosshair, AlertTriangle, Box, Users, Car, Shield, Camera, Grid3X3, Target, Eye, Activity } from 'lucide-react'

interface DetectedObject {
  id: string
  label: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
  threat: 'none' | 'low' | 'medium' | 'high'
  category: 'person' | 'vehicle' | 'object' | 'weapon' | 'unknown'
}

interface EnvironmentData {
  temperature: number
  humidity: number
  lightLevel: number
  noiseLevel: number
  location: string
  time: string
}

interface Props {
  isScanning: boolean
  detectedObjects: DetectedObject[]
  environment: EnvironmentData
  onScan: () => void
  onTrackObject: (obj: DetectedObject) => void
}

export function ARHUD({ isScanning, detectedObjects, environment, onScan, onTrackObject }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [threatMode, setThreatMode] = useState(false)
  const scanPulseRef = useRef(0)

  // Draw HUD overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let animId: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2

      // Scanning pulse effect
      if (isScanning) {
        scanPulseRef.current += 0.02
        const pulseRadius = (scanPulseRef.current % 1) * Math.min(w, h) * 0.6
        ctx.beginPath()
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0, 243, 255, ${0.3 * (1 - (scanPulseRef.current % 1))})`
        ctx.lineWidth = 2
        ctx.stroke()

        // Rotating scan line
        const angle = scanPulseRef.current * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * w, cy + Math.sin(angle) * h)
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Grid overlay
      if (showGrid) {
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)'
        ctx.lineWidth = 0.5
        const gridSize = 60
        for (let x = 0; x < w; x += gridSize) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, h)
          ctx.stroke()
        }
        for (let y = 0; y < h; y += gridSize) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(w, y)
          ctx.stroke()
        }
      }

      // Corner brackets (JARVIS style)
      const cornerSize = 40
      const cornerOffset = 30
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)'
      ctx.lineWidth = 2

      // Top-left
      ctx.beginPath()
      ctx.moveTo(cornerOffset, cornerOffset + cornerSize)
      ctx.lineTo(cornerOffset, cornerOffset)
      ctx.lineTo(cornerOffset + cornerSize, cornerOffset)
      ctx.stroke()

      // Top-right
      ctx.beginPath()
      ctx.moveTo(w - cornerOffset - cornerSize, cornerOffset)
      ctx.lineTo(w - cornerOffset, cornerOffset)
      ctx.lineTo(w - cornerOffset, cornerOffset + cornerSize)
      ctx.stroke()

      // Bottom-left
      ctx.beginPath()
      ctx.moveTo(cornerOffset, h - cornerOffset - cornerSize)
      ctx.lineTo(cornerOffset, h - cornerOffset)
      ctx.lineTo(cornerOffset + cornerSize, h - cornerOffset)
      ctx.stroke()

      // Bottom-right
      ctx.beginPath()
      ctx.moveTo(w - cornerOffset - cornerSize, h - cornerOffset)
      ctx.lineTo(w - cornerOffset, h - cornerOffset)
      ctx.lineTo(w - cornerOffset, h - cornerOffset - cornerSize)
      ctx.stroke()

      // Center crosshair
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx - 20, cy)
      ctx.lineTo(cx + 20, cy)
      ctx.moveTo(cx, cy - 20)
      ctx.lineTo(cx, cy + 20)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, 8, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)'
      ctx.stroke()

      // Detection boxes
      detectedObjects.forEach((obj) => {
        const bx = obj.x * w
        const by = obj.y * h
        const bw = obj.width * w
        const bh = obj.height * h

        // Color based on threat/category
        let color = '0, 243, 255'
        if (obj.category === 'person') color = '0, 255, 136'
        if (obj.category === 'vehicle') color = '255, 170, 0'
        if (obj.threat === 'high') color = '255, 50, 50'
        else if (obj.threat === 'medium') color = '255, 170, 0'

        // Bounding box
        ctx.strokeStyle = `rgba(${color}, 0.8)`
        ctx.lineWidth = 2
        ctx.strokeRect(bx, by, bw, bh)

        // Corner markers
        const m = 6
        ctx.beginPath()
        ctx.moveTo(bx, by + m)
        ctx.lineTo(bx, by)
        ctx.lineTo(bx + m, by)
        ctx.moveTo(bx + bw - m, by)
        ctx.lineTo(bx + bw, by)
        ctx.lineTo(bx + bw, by + m)
        ctx.moveTo(bx + bw, by + bh - m)
        ctx.lineTo(bx + bw, by + bh)
        ctx.lineTo(bx + bw - m, by + bh)
        ctx.moveTo(bx + m, by + bh)
        ctx.lineTo(bx, by + bh)
        ctx.lineTo(bx, by + bh - m)
        ctx.stroke()

        // Label background
        const label = `${obj.label} ${Math.round(obj.confidence * 100)}%`
        ctx.font = '12px monospace'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = `rgba(${color}, 0.2)`
        ctx.fillRect(bx, by - 20, tw + 10, 20)
        ctx.fillStyle = `rgba(${color}, 1)`
        ctx.fillText(label, bx + 5, by - 6)

        // Threat indicator
        if (obj.threat !== 'none') {
          ctx.fillStyle = `rgba(${color}, 0.8)`
          ctx.beginPath()
          ctx.moveTo(bx + bw - 10, by + 10)
          ctx.lineTo(bx + bw - 5, by + 5)
          ctx.lineTo(bx + bw, by + 10)
          ctx.fill()
        }
      })

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [isScanning, detectedObjects, showGrid])

  const getThreatColor = (threat: string) => {
    switch (threat) {
      case 'high': return 'text-red-400'
      case 'medium': return 'text-yellow-400'
      case 'low': return 'text-blue-400'
      default: return 'text-green-400'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'person': return <Users className="w-3 h-3" />
      case 'vehicle': return <Car className="w-3 h-3" />
      case 'weapon': return <AlertTriangle className="w-3 h-3" />
      default: return <Box className="w-3 h-3" />
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* HUD Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 5 }}
      />

      {/* Top Bar - System Status */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4" style={{ zIndex: 10 }}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-lg px-3 py-1.5 border border-cyan-500/30">
            <Eye className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400">AR VISION ACTIVE</span>
            {isScanning && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              />
            )}
          </div>
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-lg px-3 py-1 border border-cyan-500/20">
            <Activity className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-mono text-green-400">SYS: ONLINE</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-1.5 border border-cyan-500/30">
            <span className="text-xs font-mono text-cyan-400">{environment.time}</span>
          </div>
          <div className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-1 border border-cyan-500/20">
            <span className="text-[10px] font-mono text-cyan-400/70">{environment.location}</span>
          </div>
        </div>
      </div>

      {/* Left Panel - Detected Objects */}
      <div className="absolute left-4 top-24 bottom-24 w-56 flex flex-col gap-2" style={{ zIndex: 10 }}>
        <div className="bg-black/70 backdrop-blur-md rounded-xl border border-cyan-500/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/20">
            <span className="text-xs font-mono text-cyan-400">DETECTED OBJECTS</span>
            <span className="text-[10px] font-mono text-cyan-400/60">{detectedObjects.length}</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {detectedObjects.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <span className="text-[10px] font-mono text-cyan-400/40">NO OBJECTS DETECTED</span>
              </div>
            ) : (
              detectedObjects.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => { setSelectedObject(obj); onTrackObject(obj) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-cyan-500/10 transition pointer-events-auto ${
                    selectedObject?.id === obj.id ? 'bg-cyan-500/20' : ''
                  }`}
                >
                  {getCategoryIcon(obj.category)}
                  <div className="flex-1 text-left">
                    <div className="text-[10px] font-mono text-cyan-300">{obj.label}</div>
                    <div className="text-[9px] font-mono text-cyan-400/50">{Math.round(obj.confidence * 100)}%</div>
                  </div>
                  {obj.threat !== 'none' && (
                    <AlertTriangle className={`w-3 h-3 ${getThreatColor(obj.threat)}`} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Threat Assessment */}
        {threatMode && detectedObjects.some(o => o.threat !== 'none') && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-black/70 backdrop-blur-md rounded-xl border border-red-500/50 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-red-500/30 bg-red-500/10">
              <Shield className="w-3 h-3 text-red-400" />
              <span className="text-xs font-mono text-red-400">THREAT ASSESSMENT</span>
            </div>
            {detectedObjects.filter(o => o.threat !== 'none').map((obj) => (
              <div key={obj.id} className="px-3 py-2 border-b border-red-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-red-300">{obj.label}</span>
                  <span className={`text-[10px] font-mono uppercase ${getThreatColor(obj.threat)}`}>{obj.threat}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Right Panel - Environment Data */}
      <div className="absolute right-4 top-24 w-48 flex flex-col gap-2" style={{ zIndex: 10 }}>
        <div className="bg-black/70 backdrop-blur-md rounded-xl border border-cyan-500/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Grid3X3 className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400">ENVIRONMENT</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-cyan-500/5 rounded-lg p-2">
              <div className="text-[9px] font-mono text-cyan-400/50">TEMP</div>
              <div className="text-sm font-mono text-cyan-300">{environment.temperature}°C</div>
            </div>
            <div className="bg-cyan-500/5 rounded-lg p-2">
              <div className="text-[9px] font-mono text-cyan-400/50">HUMIDITY</div>
              <div className="text-sm font-mono text-cyan-300">{environment.humidity}%</div>
            </div>
            <div className="bg-cyan-500/5 rounded-lg p-2">
              <div className="text-[9px] font-mono text-cyan-400/50">LIGHT</div>
              <div className="text-sm font-mono text-cyan-300">{environment.lightLevel} lux</div>
            </div>
            <div className="bg-cyan-500/5 rounded-lg p-2">
              <div className="text-[9px] font-mono text-cyan-400/50">NOISE</div>
              <div className="text-sm font-mono text-cyan-300">{environment.noiseLevel} dB</div>
            </div>
          </div>
        </div>

        {/* Object Count by Category */}
        <div className="bg-black/70 backdrop-blur-md rounded-xl border border-cyan-500/30 p-3">
          <span className="text-[10px] font-mono text-cyan-400">SCAN STATISTICS</span>
          <div className="mt-2 space-y-1">
            {['person', 'vehicle', 'object', 'weapon'].map((cat) => {
              const count = detectedObjects.filter(o => o.category === cat).length
              return (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-cyan-400/60 capitalize">{cat}s</span>
                  <span className="text-[10px] font-mono text-cyan-300">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3" style={{ zIndex: 10 }}>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`pointer-events-auto p-3 rounded-xl border transition ${
            showGrid ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400' : 'bg-black/60 border-cyan-500/30 text-cyan-400/60'
          }`}
        >
          <Grid3X3 className="w-5 h-5" />
        </button>

        <button
          onClick={onScan}
          disabled={isScanning}
          className={`pointer-events-auto px-6 py-3 rounded-xl border-2 font-mono text-sm transition flex items-center gap-2 ${
            isScanning
              ? 'bg-cyan-500/30 border-cyan-400 text-cyan-400 animate-pulse'
              : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-400'
          }`}
        >
          <Scan className="w-5 h-5" />
          {isScanning ? 'SCANNING...' : 'SCAN ENVIRONMENT'}
        </button>

        <button
          onClick={() => setThreatMode(!threatMode)}
          className={`pointer-events-auto p-3 rounded-xl border transition ${
            threatMode ? 'bg-red-500/20 border-red-400 text-red-400' : 'bg-black/60 border-cyan-500/30 text-cyan-400/60'
          }`}
        >
          <Shield className="w-5 h-5" />
        </button>

        <button
          onClick={() => setSelectedObject(null)}
          className="pointer-events-auto p-3 rounded-xl bg-black/60 border border-cyan-500/30 text-cyan-400/60 hover:text-cyan-400 transition"
        >
          <Target className="w-5 h-5" />
        </button>
      </div>

      {/* Selected Object Detail */}
      <AnimatePresence>
        {selectedObject && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl rounded-xl border border-cyan-500/40 p-4 min-w-[300px]"
            style={{ zIndex: 10 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getCategoryIcon(selectedObject.category)}
                <span className="text-sm font-mono text-cyan-300">{selectedObject.label}</span>
              </div>
              <button onClick={() => setSelectedObject(null)} className="text-cyan-400/60 hover:text-cyan-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="text-cyan-400/50">CONFIDENCE</div>
              <div className="text-cyan-300">{Math.round(selectedObject.confidence * 100)}%</div>
              <div className="text-cyan-400/50">POSITION</div>
              <div className="text-cyan-300">{selectedObject.x.toFixed(2)}, {selectedObject.y.toFixed(2)}</div>
              <div className="text-cyan-400/50">SIZE</div>
              <div className="text-cyan-300">{selectedObject.width.toFixed(2)} x {selectedObject.height.toFixed(2)}</div>
              <div className="text-cyan-400/50">THREAT LEVEL</div>
              <div className={`uppercase ${getThreatColor(selectedObject.threat)}`}>{selectedObject.threat}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanning Indicator Line */}
      {isScanning && (
        <motion.div
          className="absolute left-0 right-0 h-0.5 bg-cyan-400/50"
          style={{ zIndex: 8 }}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}
