import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PenLineIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { TreeNode } from "../types";

const NODE_WIDTH = 240;
const NODE_GAP_X = 60;
// Q+A両方表示時の最大ノード高さを考慮した余白
const NODE_GAP_Y = 180;

// ノードの幅・位置を計算（ツリーレイアウト）
// 仮想ノード（＋補足する）を含むIDリストで計算する
function layoutNodes(
  allNodeIds: string[],
  childrenMap: Map<string, string[]>,
  depthMap: Map<string, number>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  let leafIndex = 0;

  function calcX(id: string): number {
    const kids = childrenMap.get(id) ?? [];
    const depth = depthMap.get(id) ?? 0;
    if (kids.length === 0) {
      const x = leafIndex * (NODE_WIDTH + NODE_GAP_X);
      leafIndex++;
      positions.set(id, { x, y: depth * NODE_GAP_Y });
      return x;
    }
    const xs = kids.map((kid) => calcX(kid));
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    positions.set(id, { x, y: depth * NODE_GAP_Y });
    return x;
  }

  // ルートノード（depth=0）から開始
  for (const id of allNodeIds) {
    if (depthMap.get(id) === 0) {
      calcX(id);
    }
  }

  return positions;
}

type QANodeData = {
  text: string;
  answer: string;
  selected: boolean;
  nodeType: "question" | "visualize" | "free_input";
};

function QANode({ data }: NodeProps) {
  const d = data as unknown as QANodeData;
  const answered = d.answer !== "";
  const isFreeInput = d.nodeType === "free_input";

  if (isFreeInput) {
    return (
      <div
        style={{ width: NODE_WIDTH }}
        className="rounded-xl shadow-sm border-2 border-green-300 overflow-hidden"
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{ opacity: 0, pointerEvents: "none" }}
        />
        <div className="px-3 py-2 bg-blue-50">
          <p className="text-xs font-semibold text-blue-500 flex items-center gap-1 mb-0.5">
            <PenLineIcon size={10} />
            自由回答
          </p>
          <p className="text-sm text-gray-800 leading-snug">{d.text}</p>
        </div>
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

type AddSupplementData = {
  parentNodeId: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AddSupplementNode(_props: NodeProps) {
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-xl border-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-all"
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <div className="px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
        <PenLineIcon size={12} />
        自由に回答する
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

const nodeTypes = { qa: QANode, addSupplement: AddSupplementNode };

interface Props {
  treeNodes: TreeNode[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
  onFreeInputFromNode?: (nodeId: string) => void;
}

export function ConversationTreeView({
  treeNodes,
  selectedNodeId,
  onNodeSelect,
  onFreeInputFromNode,
}: Props) {
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "addSupplement") {
        const d = node.data as unknown as AddSupplementData;
        onFreeInputFromNode?.(d.parentNodeId);
        return;
      }
      const data = node.data as unknown as QANodeData;
      if (data.answer !== "") return;
      onNodeSelect(node.id);
    },
    [onNodeSelect, onFreeInputFromNode]
  );

  const { nodes, edges } = useMemo(() => {
    if (treeNodes.length === 0) return { nodes: [], edges: [] };

    // 子ノードマップを構築
    const childrenMap = new Map<string, string[]>();
    const depthMap = new Map<string, number>();
    const nodeById = new Map<string, TreeNode>();

    for (const n of treeNodes) {
      nodeById.set(n.id, n);
      if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
      childrenMap.get(n.parentId)!.push(n.id);
    }

    // 回答済みノードに仮想「＋補足する」ノードを追加
    const supplementIds: string[] = [];
    const supplementParents = new Map<string, string>(); // supplementId → parentNodeId

    for (const n of treeNodes) {
      if (n.answer !== "" && n.parentId !== "") {
        // この回答済みノードの子として「＋補足する」を追加
        const suppId = `supp-${n.id}`;
        supplementIds.push(suppId);
        supplementParents.set(suppId, n.id);
        if (!childrenMap.has(n.id)) childrenMap.set(n.id, []);
        childrenMap.get(n.id)!.push(suppId);
      }
    }

    // 深さ計算
    function calcDepth(id: string, depth: number) {
      depthMap.set(id, depth);
      for (const kid of childrenMap.get(id) ?? []) {
        calcDepth(kid, depth + 1);
      }
    }
    const roots = treeNodes.filter((n) => n.parentId === "");
    roots.forEach((r) => calcDepth(r.id, 0));

    // 全ノードIDリスト
    const allIds = [...treeNodes.map((n) => n.id), ...supplementIds];

    const positions = layoutNodes(allIds, childrenMap, depthMap);

    // 実ノード
    const nodes: Node[] = treeNodes.map((n) => ({
      id: n.id,
      type: "qa",
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: {
        text: n.text,
        answer: n.answer,
        selected: n.id === selectedNodeId,
        nodeType: n.type,
      },
    }));

    // 仮想「＋補足する」ノード
    for (const suppId of supplementIds) {
      nodes.push({
        id: suppId,
        type: "addSupplement",
        position: positions.get(suppId) ?? { x: 0, y: 0 },
        data: {
          parentNodeId: supplementParents.get(suppId)!,
        },
      });
    }

    // エッジ（実ノード間）
    const edges: Edge[] = treeNodes
      .filter((n) => n.parentId !== "")
      .map((n) => ({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId,
        target: n.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
      }));

    // エッジ（仮想ノードへ）
    for (const suppId of supplementIds) {
      const parentId = supplementParents.get(suppId)!;
      edges.push({
        id: `e-${parentId}-${suppId}`,
        source: parentId,
        target: suppId,
        type: "smoothstep",
        style: { strokeDasharray: "5 5", stroke: "#d1d5db" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: "#d1d5db",
        },
      });
    }

    return { nodes, edges };
  }, [treeNodes, selectedNodeId]);

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
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
