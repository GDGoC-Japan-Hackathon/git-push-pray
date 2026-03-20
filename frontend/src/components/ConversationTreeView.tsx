import {
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PenLineIcon } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import type { TreeNode } from "../types";

const NODE_WIDTH = 240;
const NODE_HEIGHT_Q = 60; // 質問のみ
const NODE_HEIGHT_QA = 110; // 質問＋回答
const NODE_HEIGHT_SUPP = 40; // 補足ボタン
const NODE_GAP_X = 60;
// Q+A両方表示時の最大ノード高さを考慮した余白
const NODE_GAP_Y = 180;

// 1階層あたりのアニメーション遅延（秒）
const ANIM_STEP = 0.3;

// 既知ノードIDを追跡（モジュールレベル）
// 初回表示時のノードはアニメーションしない。追加されたノードのみアニメーション対象
const knownNodeIds = new Set<string>();

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

// --- カスタムエッジ ---

function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as Record<string, unknown> | undefined;
  const isNew = !!edgeData?.isNew;
  const targetDepth = (edgeData?.targetDepth as number) ?? 1;
  const isDashed = !!style?.strokeDasharray;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  // 既存エッジ: 通常表示（アニメーションなし）
  if (!isNew) {
    return (
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        stroke={isDashed ? ((style?.stroke as string) ?? "#d1d5db") : "#b1b1b7"}
        strokeWidth={isDashed ? 1 : 1.5}
        strokeDasharray={isDashed ? "5 5" : undefined}
        markerEnd={markerEnd as string}
      />
    );
  }

  // 新規エッジ: アニメーション付き
  const edgeDelay = Math.max(
    0,
    (targetDepth - 1) * ANIM_STEP + ANIM_STEP * 0.4
  );

  if (isDashed) {
    return (
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        stroke={(style?.stroke as string) ?? "#d1d5db"}
        strokeWidth={1}
        strokeDasharray="5 5"
        style={{
          opacity: 0,
          animation: `edge-fade-in 0.25s ease ${edgeDelay}s forwards`,
        }}
      />
    );
  }

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      fill="none"
      stroke="#b1b1b7"
      strokeWidth={1.5}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1}
      style={{
        animation: `edge-draw 0.28s ease ${edgeDelay}s forwards`,
      }}
    />
  );
}

const edgeTypes = { animated: AnimatedEdge };

// --- カスタムノード ---

type QANodeData = {
  text: string;
  answer: string;
  selected: boolean;
  nodeType: "question" | "visualize" | "free_input";
  depth: number;
  isNew: boolean;
};

function QANode({ data }: NodeProps) {
  const d = data as unknown as QANodeData;
  const answered = d.answer !== "";
  const isFreeInput = d.nodeType === "free_input";
  const isVisualize = d.nodeType === "visualize";
  const animStyle = d.isNew
    ? { width: NODE_WIDTH, animationDelay: `${d.depth * ANIM_STEP}s` }
    : { width: NODE_WIDTH };

  if (isFreeInput) {
    return (
      <div
        style={animStyle}
        className={`rounded-xl shadow-sm border-2 border-green-300 overflow-hidden ${d.isNew ? "node-enter" : ""}`}
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

  // ボーダー色の決定
  let borderClass: string;
  if (answered) {
    borderClass = isVisualize
      ? "border-purple-300 cursor-not-allowed"
      : "border-green-300 cursor-not-allowed";
  } else if (d.selected) {
    borderClass = isVisualize
      ? "border-purple-500 shadow-purple-200 shadow-md cursor-pointer"
      : "border-blue-500 shadow-blue-200 shadow-md cursor-pointer";
  } else {
    borderClass = isVisualize
      ? "border-purple-200 hover:border-purple-400 hover:shadow-md cursor-pointer"
      : "border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer";
  }

  return (
    <div
      style={animStyle}
      className={`rounded-xl shadow-sm border-2 transition-all overflow-hidden ${d.isNew ? "node-enter" : ""} ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      {/* 質問エリア */}
      <div
        className={`px-3 py-2 ${
          answered
            ? isVisualize
              ? "bg-purple-50"
              : "bg-blue-50"
            : isVisualize
              ? "bg-purple-50/40"
              : "bg-white"
        }`}
      >
        <p
          className={`text-xs font-semibold mb-0.5 ${isVisualize ? "text-purple-500" : "text-blue-500"}`}
        >
          Q
        </p>
        <p className="text-sm text-gray-800 leading-snug">{d.text}</p>
      </div>

      {/* 回答エリア（回答済みの場合のみ表示） */}
      {answered && (
        <div
          className={`px-3 py-2 border-t border-gray-100 ${isVisualize ? "bg-purple-50" : "bg-green-50"}`}
        >
          <p
            className={`text-xs font-semibold mb-0.5 ${isVisualize ? "text-purple-600" : "text-green-600"}`}
          >
            A
          </p>
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
  depth: number;
  isNew: boolean;
};

function AddSupplementNode({ data }: NodeProps) {
  const d = data as unknown as AddSupplementData;
  const animStyle = d.isNew
    ? { width: NODE_WIDTH, animationDelay: `${d.depth * ANIM_STEP}s` }
    : { width: NODE_WIDTH };

  return (
    <div
      style={animStyle}
      className={`rounded-xl border-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-all ${d.isNew ? "node-enter" : ""}`}
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

    const isInitial = knownNodeIds.size === 0;

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
      if (n.answer !== "" || n.parentId === "") {
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

    // 新規ノードの最小深さ（アニメーション遅延の基準に使用）
    let minNewDepth = Infinity;
    if (!isInitial) {
      for (const n of treeNodes) {
        if (!knownNodeIds.has(n.id)) {
          const d = depthMap.get(n.id) ?? 0;
          if (d < minNewDepth) minNewDepth = d;
        }
      }
      for (const suppId of supplementIds) {
        if (!knownNodeIds.has(suppId)) {
          const d = depthMap.get(suppId) ?? 0;
          if (d < minNewDepth) minNewDepth = d;
        }
      }
    }

    // 実ノード
    const nodes: Node[] = treeNodes.map((n) => {
      const nodeIsNew = !isInitial && !knownNodeIds.has(n.id);
      return {
        id: n.id,
        type: "qa",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: n.answer !== "" ? NODE_HEIGHT_QA : NODE_HEIGHT_Q,
        data: {
          text: n.text,
          answer: n.answer,
          selected: n.id === selectedNodeId,
          nodeType: n.type,
          depth: (depthMap.get(n.id) ?? 0) - (nodeIsNew ? minNewDepth : 0),
          isNew: nodeIsNew,
        },
      };
    });

    // 仮想「＋補足する」ノード
    for (const suppId of supplementIds) {
      const suppIsNew = !isInitial && !knownNodeIds.has(suppId);
      nodes.push({
        id: suppId,
        type: "addSupplement",
        position: positions.get(suppId) ?? { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: NODE_HEIGHT_SUPP,
        data: {
          parentNodeId: supplementParents.get(suppId)!,
          depth: (depthMap.get(suppId) ?? 0) - (suppIsNew ? minNewDepth : 0),
          isNew: suppIsNew,
        },
      });
    }

    // エッジ（実ノード間）
    const edges: Edge[] = treeNodes
      .filter((n) => n.parentId !== "")
      .map((n) => {
        const edgeIsNew = !isInitial && !knownNodeIds.has(n.id);
        return {
          id: `e-${n.parentId}-${n.id}`,
          source: n.parentId,
          target: n.id,
          type: "animated",
          data: {
            targetDepth:
              (depthMap.get(n.id) ?? 1) - (edgeIsNew ? minNewDepth : 0),
            isNew: edgeIsNew,
          },
          ...(edgeIsNew
            ? {}
            : {
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                },
              }),
        };
      });

    // エッジ（仮想ノードへ）
    for (const suppId of supplementIds) {
      const parentId = supplementParents.get(suppId)!;
      const edgeIsNew = !isInitial && !knownNodeIds.has(suppId);
      edges.push({
        id: `e-${parentId}-${suppId}`,
        source: parentId,
        target: suppId,
        type: "animated",
        style: { strokeDasharray: "5 5", stroke: "#d1d5db" },
        data: {
          targetDepth:
            (depthMap.get(suppId) ?? 1) - (edgeIsNew ? minNewDepth : 0),
          isNew: edgeIsNew,
        },
        ...(edgeIsNew
          ? {}
          : {
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 16,
                height: 16,
                color: "#d1d5db",
              },
            }),
      });
    }

    return { nodes, edges };
  }, [treeNodes, selectedNodeId]);

  // レンダー後に現在のノードIDを記録
  useEffect(() => {
    for (const n of treeNodes) {
      knownNodeIds.add(n.id);
      if (n.answer !== "" || n.parentId === "") {
        knownNodeIds.add(`supp-${n.id}`);
      }
    }
  }, [treeNodes]);

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
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={handleNodeClick}
      >
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            if (node.type === "addSupplement") return "#9ca3af";
            const nd = node.data as unknown as QANodeData;
            if (nd.nodeType === "visualize") return "#a855f7";
            if (nd.nodeType === "free_input") return "#22c55e";
            return nd.answer !== "" ? "#22c55e" : "#3b82f6";
          }}
        />
      </ReactFlow>
    </div>
  );
}
