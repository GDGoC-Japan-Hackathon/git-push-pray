import { useState, useRef, useEffect, useCallback } from 'react'
import { Code, Eye, Copy, Check } from 'lucide-react'
import type { Artifact } from '../types'

interface Props {
  artifact: Artifact
}

export function ArtifactRenderer({ artifact }: Props) {
  const [showCode, setShowCode] = useState(false)
  const [iframeHeight, setIframeHeight] = useState(300)
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleMessage = useCallback((event: MessageEvent) => {
    if (
      event.data?.type === 'resize' &&
      typeof event.data.height === 'number' &&
      iframeRef.current &&
      event.source === iframeRef.current.contentWindow
    ) {
      setIframeHeight(Math.min(Math.max(event.data.height, 100), 800))
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ResizeObserverスクリプトを注入
  const srcdoc = artifact.code.replace(
    '</body>',
    `<script>
      new ResizeObserver(() => {
        window.parent.postMessage(
          { type: 'resize', height: document.body.scrollHeight + 16 },
          '*'
        );
      }).observe(document.body);
    </script></body>`,
  )

  return (
    <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-600 truncate">
          {artifact.title}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
            title="コードをコピー"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <button
            onClick={() => setShowCode(v => !v)}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
            title={showCode ? 'プレビュー' : 'コードを表示'}
          >
            {showCode ? <Eye size={14} /> : <Code size={14} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {showCode ? (
        <pre className="p-3 text-xs overflow-auto bg-gray-900 text-gray-100 max-h-[500px]">
          <code>{artifact.code}</code>
        </pre>
      ) : (
        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          sandbox="allow-scripts"
          style={{ width: '100%', height: iframeHeight, border: 'none' }}
          title={artifact.title}
        />
      )}
    </div>
  )
}
