import { useMemo } from 'react'
import {
  ReactFlow,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ChatSession } from '../types'

const NODE_WIDTH = 260
const NODE_HEIGHT = 80
const NODE_GAP_Y = 60

function AssistantNode({ data }: NodeProps) {
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="bg-white border border-gray-300 rounded-xl shadow-sm px-4 py-3 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <p className="text-xs font-semibold text-blue-500 mb-1">AI</p>
      <p className="text-sm text-gray-700 leading-snug line-clamp-2">{data.label as string}</p>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}

const nodeTypes = { assistant: AssistantNode }

function buildNodesAndEdges(session: ChatSession | null): { nodes: Node[]; edges: Edge[] } {
  if (!session) return { nodes: [], edges: [] }

  const assistantMessages = session.messages.filter(m => m.role === 'assistant')

  const nodes: Node[] = assistantMessages.map((msg, i) => ({
    id: msg.id,
    type: 'assistant',
    position: { x: 0, y: i * (NODE_HEIGHT + NODE_GAP_Y) },
    data: { label: msg.content.slice(0, 120) + (msg.content.length > 120 ? '…' : '') },
  }))

  const edges: Edge[] = assistantMessages.slice(1).map((msg, i) => ({
    id: `e-${assistantMessages[i].id}-${msg.id}`,
    source: assistantMessages[i].id,
    target: msg.id,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
  }))

  return { nodes, edges }
}

interface Props {
  session: ChatSession | null
}

export function MindMapView({ session }: Props) {
  const { nodes, edges } = useMemo(() => buildNodesAndEdges(session), [session])

  if (!session || nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        まだAIのメッセージがありません
      </div>
    )
  }

  return (
    <div className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
      />
    </div>
  )
}
