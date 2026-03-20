import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
} from "@codesandbox/sandpack-react";
import { Check, Code, Copy, Eye, Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Artifact } from "../types";

const SANDPACK_DEPENDENCIES: Record<string, string> = {
  recharts: "2.15.3",
  "framer-motion": "12.12.2",
  d3: "7.9.0",
  "@radix-ui/themes": "3.2.0",
  katex: "0.16.9",
  "react-katex": "3.0.0",
  three: "0.170.0",
  "@react-three/fiber": "8.17.14",
  "@react-three/drei": "9.122.0",
};

const SANDPACK_EXTERNAL_RESOURCES = [
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css",
];

interface Props {
  artifact: Artifact;
}

function SandpackContent({
  code,
  showCode,
  height,
}: {
  code: string;
  showCode: boolean;
  height: number | string;
}) {
  const cssHeight = typeof height === "number" ? `${height}px` : height;
  return (
    <SandpackProvider
      template="react"
      files={{ "/App.js": code }}
      customSetup={{ dependencies: SANDPACK_DEPENDENCIES }}
      options={{ externalResources: SANDPACK_EXTERNAL_RESOURCES }}
    >
      <SandpackLayout
        style={{ "--sp-layout-height": cssHeight } as React.CSSProperties}
      >
        {showCode ? (
          <SandpackCodeEditor
            showLineNumbers
            readOnly
            style={{ height: cssHeight }}
          />
        ) : (
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
            style={{ height: cssHeight }}
          />
        )}
      </SandpackLayout>
    </SandpackProvider>
  );
}

export function ArtifactRenderer({ artifact }: Props) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

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
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} />
            )}
          </button>
          <button
            onClick={() => setShowCode((v) => !v)}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
            title={showCode ? "プレビュー" : "コードを表示"}
          >
            {showCode ? <Eye size={14} /> : <Code size={14} />}
          </button>
          <button
            onClick={() => setIsFullscreen(true)}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
            title="全画面表示"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <SandpackContent code={artifact.code} showCode={showCode} height={400} />

      {/* Fullscreen Modal */}
      {isFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm"
            onClick={() => setIsFullscreen(false)}
          >
            <div
              className="flex flex-col m-4 md:m-8 flex-1 rounded-xl overflow-hidden bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700 truncate">
                  {artifact.title}
                </span>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                  title="閉じる"
                >
                  <X size={18} />
                </button>
              </div>
              {/* Modal Content */}
              <SandpackContent
                code={artifact.code}
                showCode={showCode}
                height="calc(100vh - 120px)"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
