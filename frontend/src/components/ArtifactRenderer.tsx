import { useState, useRef, useEffect, useCallback } from 'react'
import { Code, Eye, Copy, Check } from 'lucide-react'
import type { Artifact } from '../types'

const RESIZE_SCRIPT = `<script>
new ResizeObserver(() => {
  window.parent.postMessage(
    { type: 'resize', height: document.body.scrollHeight + 16 },
    '*'
  );
}).observe(document.body);
</script>`

const BASE_HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.tailwindcss.com"></` + `script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; padding: 16px; color: #1f2937; background: #fff; -webkit-font-smoothing: antialiased; }
</style>`

function buildDocument(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>${BASE_HEAD}</head>
<body>${bodyContent}${RESIZE_SCRIPT}</body>
</html>`
}

function injectResizeObserver(html: string): string {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${RESIZE_SCRIPT}</body>`)
  }
  return html + RESIZE_SCRIPT
}

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

  // AIのコードが完全なHTMLドキュメントかどうかを判定
  const isFullDocument = /^\s*<!doctype\s|^\s*<html[\s>]/i.test(artifact.code)

  // ベーステンプレートでラップ（AIはbody内のコンテンツだけでOK）
  const srcdoc = isFullDocument
    ? injectResizeObserver(artifact.code)
    : buildDocument(artifact.code)

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
