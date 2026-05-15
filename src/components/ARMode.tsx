import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, CameraOff, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { ARHUD } from './ARHUD'

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
  onBack: () => void
}

export function ARMode({ onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([])
  const [environment, setEnvironment] = useState<EnvironmentData>({
    temperature: 22,
    humidity: 45,
    lightLevel: 350,
    noiseLevel: 42,
    location: 'UNKNOWN',
    time: new Date().toLocaleTimeString(),
  })
  const scanIntervalRef = useRef<any>(null)

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch {
      alert('Camera access denied or not available')
    }
  }, [])

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream
    stream?.getTracks().forEach(t => t.stop())
    setCameraActive(false)
    setIsScanning(false)
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
  }, [])

  // Simulate AI vision analysis
  const scanEnvironment = useCallback(() => {
    if (!cameraActive) return
    setIsScanning(true)

    // In real implementation, send frame to vision API
    // For demo, simulate detections
    const mockObjects: DetectedObject[] = [
      { id: '1', label: 'Person', confidence: 0.94, x: 0.3, y: 0.2, width: 0.15, height: 0.4, threat: 'none', category: 'person' },
      { id: '2', label: 'Vehicle', confidence: 0.87, x: 0.6, y: 0.5, width: 0.25, height: 0.2, threat: 'low', category: 'vehicle' },
      { id: '3', label: 'Chair', confidence: 0.76, x: 0.15, y: 0.6, width: 0.1, height: 0.15, threat: 'none', category: 'object' },
      { id: '4', label: 'Table', confidence: 0.82, x: 0.5, y: 0.7, width: 0.2, height: 0.1, threat: 'none', category: 'object' },
    ]

    // Randomize slightly for demo
    setDetectedObjects(mockObjects.map(obj => ({
      ...obj,
      confidence: Math.min(0.99, obj.confidence + (Math.random() - 0.5) * 0.1),
    })))

    // Update environment
    setEnvironment(prev => ({
      ...prev,
      time: new Date().toLocaleTimeString(),
      temperature: prev.temperature + (Math.random() - 0.5) * 0.5,
    }))

    setTimeout(() => setIsScanning(false), 2000)
  }, [cameraActive])

  // Auto-scan every 5 seconds when active
  useEffect(() => {
    if (cameraActive && !scanIntervalRef.current) {
      scanIntervalRef.current = setInterval(scanEnvironment, 5000)
      scanEnvironment()
    }
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
        scanIntervalRef.current = null
      }
    }
  }, [cameraActive, scanEnvironment])

  // Export to spreadsheet
  const exportToSpreadsheet = useCallback(() => {
    const csv = [
      ['ID', 'Label', 'Category', 'Confidence', 'Threat', 'Position X', 'Position Y', 'Width', 'Height'],
      ...detectedObjects.map(obj => [
        obj.id, obj.label, obj.category, obj.confidence, obj.threat,
        obj.x.toFixed(3), obj.y.toFixed(3), obj.width.toFixed(3), obj.height.toFixed(3)
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ar-scan-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [detectedObjects])

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Fallback when no camera */}
      {!cameraActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-jarvis-bg">
          <div className="text-center">
            <CameraOff className="w-16 h-16 text-cyan-400/30 mx-auto mb-4" />
            <p className="text-cyan-400/50 font-mono text-sm">CAMERA INACTIVE</p>
            <button
              onClick={startCamera}
              className="mt-4 px-6 py-3 bg-cyan-500/20 border border-cyan-400/50 rounded-xl text-cyan-400 font-mono hover:bg-cyan-500/30 transition"
            >
              ACTIVATE CAMERA
            </button>
          </div>
        </div>
      )}

      {/* HUD Overlay */}
      {cameraActive && (
        <ARHUD
          isScanning={isScanning}
          detectedObjects={detectedObjects}
          environment={environment}
          onScan={scanEnvironment}
          onTrackObject={(obj) => console.log('Tracking:', obj.label)}
        />
      )}

      {/* Top Navigation */}
      <div className="absolute top-4 left-4 flex items-center gap-3" style={{ zIndex: 20 }}>
        <button
          onClick={onBack}
          className="p-2 bg-black/60 backdrop-blur-md rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="bg-black/60 backdrop-blur-md rounded-xl border border-cyan-500/30 px-3 py-2">
          <span className="text-xs font-mono text-cyan-400">AR VISION MODE</span>
        </div>
      </div>

      {/* Camera Toggle */}
      <div className="absolute top-4 right-4" style={{ zIndex: 20 }}>
        <button
          onClick={cameraActive ? stopCamera : startCamera}
          className={`p-2 rounded-xl border transition ${
            cameraActive
              ? 'bg-red-500/20 border-red-400/50 text-red-400'
              : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-400'
          }`}
        >
          {cameraActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
        </button>
      </div>

      {/* Export Button */}
      {detectedObjects.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={exportToSpreadsheet}
          className="absolute bottom-6 right-6 p-3 bg-black/60 backdrop-blur-md rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition"
          style={{ zIndex: 20 }}
        >
          <FileSpreadsheet className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  )
}
