import React from 'react'
import { GraphVisualization } from '../components/GraphVisualization'
import { InteractiveExercise } from '../components/InteractiveExercise'

function parseLine(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const m = match[0]
    if (m.startsWith('`')) {
      parts.push(<code key={key++} className="bg-gray-200 rounded px-1 py-0.5 text-sm font-mono">{m.slice(1, -1)}</code>)
    } else if (m.startsWith('**') || m.startsWith('__')) {
      parts.push(<strong key={key++}>{m.slice(2, -2)}</strong>)
    } else {
      parts.push(<em key={key++}>{m.slice(1, -1)}</em>)
    }
    lastIndex = match.index + m.length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

export function renderMarkdown(text: string, onInteract?: (message: string) => void): React.ReactElement[] {
  const lines = text.split('\n')
  const result: React.ReactElement[] = []
  let inCodeBlock = false
  let blockLang = ''
  let codeLines: string[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        const raw = codeLines.join('\n')

        if (blockLang === 'graph' && onInteract) {
          try {
            const config = JSON.parse(raw)
            result.push(<GraphVisualization key={key++} config={config} onInteract={onInteract} />)
          } catch {
            result.push(
              <pre key={key++} className="bg-gray-200 rounded-md p-3 overflow-x-auto my-2 text-sm font-mono">
                <code>{raw}</code>
              </pre>
            )
          }
        } else if (blockLang === 'exercise' && onInteract) {
          try {
            const config = JSON.parse(raw)
            result.push(<InteractiveExercise key={key++} config={config} onInteract={onInteract} />)
          } catch {
            result.push(
              <pre key={key++} className="bg-gray-200 rounded-md p-3 overflow-x-auto my-2 text-sm font-mono">
                <code>{raw}</code>
              </pre>
            )
          }
        } else {
          result.push(
            <pre key={key++} className="bg-gray-200 rounded-md p-3 overflow-x-auto my-2 text-sm font-mono">
              <code>{raw}</code>
            </pre>
          )
        }

        codeLines = []
        blockLang = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
        blockLang = line.slice(3).trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (line.startsWith('### ')) {
      result.push(<h3 key={key++} className="font-semibold text-base mt-3 mb-1">{parseLine(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      result.push(<h2 key={key++} className="font-semibold text-lg mt-4 mb-1">{parseLine(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      result.push(<h1 key={key++} className="font-bold text-xl mt-4 mb-2">{parseLine(line.slice(2))}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      result.push(<li key={key++} className="ml-4 list-disc">{parseLine(line.slice(2))}</li>)
    } else if (/^\d+\. /.test(line)) {
      result.push(<li key={key++} className="ml-4 list-decimal">{parseLine(line.replace(/^\d+\. /, ''))}</li>)
    } else if (line === '') {
      result.push(<div key={key++} className="h-2" />)
    } else {
      result.push(<p key={key++} className="leading-relaxed">{parseLine(line)}</p>)
    }
  }

  return result
}
