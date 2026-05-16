import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Download, Terminal } from 'lucide-react'

interface Props {
  code: string
  language?: string
  filename?: string
  typing?: boolean
}

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: 'text-blue-400',
  javascript: 'text-yellow-400',
  python: 'text-green-400',
  rust: 'text-orange-400',
  go: 'text-cyan-400',
  bash: 'text-gray-400',
  shell: 'text-gray-400',
  json: 'text-amber-400',
  html: 'text-red-400',
  css: 'text-pink-400',
  sql: 'text-purple-400',
  yaml: 'text-emerald-400',
  dockerfile: 'text-blue-300',
  markdown: 'text-white',
  default: 'text-cyan-400',
}

export function CodeBlock({ code, language = 'typescript', filename, typing = true }: Props) {
  const [displayedCode, setDisplayedCode] = useState(typing ? '' : code)
  const [copied, setCopied] = useState(false)
  const [lineCount, setLineCount] = useState(1)
  const preRef = useRef<HTMLPreElement>(null)

  const langColor = LANGUAGE_COLORS[language.toLowerCase()] || LANGUAGE_COLORS.default

  useEffect(() => {
    if (!typing) {
      setDisplayedCode(code)
      setLineCount(code.split('\n').length)
      return
    }

    let index = 0
    const chars = code.split('')
    const interval = setInterval(() => {
      if (index < chars.length) {
        const next = chars.slice(0, index + 1).join('')
        setDisplayedCode(next)
        setLineCount(next.split('\n').length)
        index++
      } else {
        clearInterval(interval)
      }
    }, 4)

    return () => clearInterval(interval)
  }, [code, typing])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const ext = language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language === 'python' ? 'py' : language === 'bash' || language === 'shell' ? 'sh' : language === 'json' ? 'json' : 'txt'
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `code.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const lines = displayedCode.split('\n')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="rounded-xl overflow-hidden border border-cyan-500/20 bg-[#0a0f1a]/90 backdrop-blur-sm my-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-b border-cyan-500/10">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-400/70" />
            <span className={`text-xs font-mono font-medium ${langColor}`}>
              {language}
            </span>
          </div>
          {filename && (
            <span className="text-xs text-white/30 font-mono ml-2">{filename}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition"
            title="Copy"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Code area */}
      <div className="relative overflow-x-auto">
        <pre
          ref={preRef}
          className="flex text-sm font-mono leading-relaxed p-4 text-white/90"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
        >
          {/* Line numbers */}
          <div className="select-none pr-4 text-right border-r border-white/5 mr-4">
            {Array.from({ length: Math.max(lines.length, 1) }, (_, i) => (
              <div key={i} className="text-white/20 text-xs leading-relaxed">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code content */}
          <code className="flex-1">
            {lines.map((line, i) => (
              <div key={i} className="leading-relaxed">
                {line || ' '}
                {typing && i === lines.length - 1 && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="inline-block w-2 h-4 bg-cyan-400/80 ml-0.5 align-middle"
                  />
                )}
              </div>
            ))}
          </code>
        </pre>

        {/* Glow effect */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 bg-white/5 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-white/20 font-mono">
          {code.length} chars · {code.split('\n').length} lines
        </span>
        {typing && displayedCode.length < code.length && (
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1.5"
          >
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            <span className="text-[10px] text-cyan-400/60 font-mono">generating...</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
