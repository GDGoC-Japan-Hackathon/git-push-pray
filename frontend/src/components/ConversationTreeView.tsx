import { useMemo } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TreeNode } from "../types";

const NODE_WIDTH = 240;
const NODE_GAP_X = 60;
// Q+A両方表示時の最大ノード高さ(~130px)を考慮した余白
const NODE_GAP_Y = 160;

// ノードの幅・位置を計算（ツリーレイアウト）
function layoutNodes(
  treeNodes: TreeNode[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const children = new Map<string, string[]>();

  for (const n of treeNodes) {
    if (!children.has(n.parentId)) children.set(n.parentId, []);
    children.get(n.parentId)!.push(n.id);
  }

  let leafIndex = 0;

  function calcX(id: string, depth: number): number {
    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      const x = leafIndex * (NODE_WIDTH + NODE_GAP_X);
      leafIndex++;
      positions.set(id, { x, y: depth * NODE_GAP_Y });
      return x;
    }
    const xs = kids.map((kid) => calcX(kid, depth + 1));
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    positions.set(id, { x, y: depth * NODE_GAP_Y });
    return x;
  }

  const roots = treeNodes.filter((n) => n.parentId === "");
  roots.forEach((r) => calcX(r.id, 0));

  return positions;
}

type NodeData = {
  text: string;
  answer: string;
  selected: boolean;
};

function QANode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  const answered = d.answer !== "";

  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={`rounded-xl shadow-sm border-2 transition-all overflow-hidden
        ${
          answered
            ? "border-green-300 cursor-not-allowed"
            : d.selected
              ? "border-blue-500 shadow-blue-200 shadow-md cursor-pointer"
              : "border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer"
        }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      {/* 質問エリア */}
      <div className={`px-3 py-2 ${answered ? "bg-blue-50" : "bg-white"}`}>
        <p className="text-xs font-semibold text-blue-500 mb-0.5">Q</p>
        <p className="text-sm text-gray-800 leading-snug">{d.text}</p>
      </div>

      {/* 回答エリア（回答済みの場合のみ表示） */}
      {answered && (
        <div className="px-3 py-2 bg-green-50 border-t border-gray-100">
          <p className="text-xs font-semibold text-green-600 mb-0.5">A</p>
          <p className="text-sm text-gray-700 leading-snug">{d.answer}</p>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

const nodeTypes = { qa: QANode };

interface Props {
  treeNodes: TreeNode[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
}

export function ConversationTreeView({
  treeNodes,
  selectedNodeId,
  onNodeSelect,
}: Props) {
  const { nodes, edges } = useMemo(() => {
    if (treeNodes.length === 0) return { nodes: [], edges: [] };

    const positions = layoutNodes(treeNodes);

    const nodes: Node[] = treeNodes.map((n) => ({
      id: n.id,
      type: "qa",
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: {
        text: n.text,
        answer: n.answer,
        selected: n.id === selectedNodeId,
      },
    }));

    const edges: Edge[] = treeNodes
      .filter((n) => n.parentId !== "")
      .map((n) => ({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId,
        target: n.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
      }));

    return { nodes, edges };
  }, [treeNodes, selectedNodeId, onNodeSelect]);

  if (treeNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        まだノードがありません。チャットを開始してください。
      </div>
    );
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
        elementsSelectable={false}
        onNodeClick={(_event, node) => {
          const data = node.data as unknown as NodeData;
          if (data.answer !== "") return;
          onNodeSelect(node.id);
        }}
      />
    </div>
  );
}
