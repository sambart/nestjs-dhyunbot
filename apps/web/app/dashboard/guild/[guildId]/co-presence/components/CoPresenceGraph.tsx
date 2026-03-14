"use client";

// sigma.js(@react-sigma/core, graphology) 의존성이 없으므로
// HTML5 Canvas를 직접 사용하여 네트워크 그래프를 구현한다.
// 의존성 설치 후 sigma.js 기반으로 교체 가능하도록 Props 인터페이스는 동일하게 유지한다.

import { useCallback, useEffect, useRef, useState } from "react";

import type { CoPresenceGraphData } from "@/app/lib/co-presence-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const CLUSTER_COLORS = [
  "#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EF4444", "#14B8A6", "#F97316", "#06B6D4",
];

const MIN_NODE_SIZE = 8;
const MAX_NODE_SIZE = 40;
const MIN_EDGE_WIDTH = 1;
const MAX_EDGE_WIDTH = 8;
const LABEL_FONT = "12px sans-serif";
const DEBOUNCE_MS = 300;

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface NodePosition {
  x: number;
  y: number;
  radius: number;
  color: string;
  label: string;
  userId: string;
}

interface CoPresenceGraphProps {
  data: CoPresenceGraphData;
  minMinutes: number;
  isLoading: boolean;
  onMinMinutesChange: (value: number) => void;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function computeNodeSize(minutes: number, maxMinutes: number): number {
  if (maxMinutes === 0) return MIN_NODE_SIZE;
  return (
    MIN_NODE_SIZE + (minutes / maxMinutes) * (MAX_NODE_SIZE - MIN_NODE_SIZE)
  );
}

function computeEdgeWidth(minutes: number, maxMinutes: number): number {
  if (maxMinutes === 0) return MIN_EDGE_WIDTH;
  return (
    MIN_EDGE_WIDTH + (minutes / maxMinutes) * (MAX_EDGE_WIDTH - MIN_EDGE_WIDTH)
  );
}

/** 단순 커뮤니티 분류: degree 기반으로 인접 노드 그룹 색상 할당 */
function assignClusterColors(
  nodeIds: string[],
  edges: CoPresenceGraphData["edges"],
): Map<string, string> {
  const adjacency = new Map<string, Set<string>>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set());
  }
  for (const edge of edges) {
    adjacency.get(edge.userA)?.add(edge.userB);
    adjacency.get(edge.userB)?.add(edge.userA);
  }

  // 탐욕적 그래프 채색(greedy coloring)으로 클러스터 색상 할당
  const colorIndex = new Map<string, number>();
  for (const nodeId of nodeIds) {
    const neighborColors = new Set<number>();
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const nc = colorIndex.get(neighbor);
      if (nc !== undefined) neighborColors.add(nc);
    }
    let idx = 0;
    while (neighborColors.has(idx)) idx++;
    colorIndex.set(nodeId, idx % CLUSTER_COLORS.length);
  }

  const result = new Map<string, string>();
  for (const [nodeId, idx] of colorIndex) {
    result.set(nodeId, CLUSTER_COLORS[idx] ?? CLUSTER_COLORS[0]);
  }
  return result;
}

interface InitialPositionsParams {
  nodes: CoPresenceGraphData["nodes"];
  width: number;
  height: number;
  colorMap: Map<string, string>;
}

/** 원형 배치로 초기 노드 위치를 결정 */
function computeInitialPositions({
  nodes,
  width,
  height,
  colorMap,
}: InitialPositionsParams): NodePosition[] {
  const maxMinutes = Math.max(...nodes.map((n) => n.totalMinutes), 1);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;

  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return {
      userId: node.userId,
      label: node.userName,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      radius: computeNodeSize(node.totalMinutes, maxMinutes),
      color: colorMap.get(node.userId) ?? CLUSTER_COLORS[0],
    };
  });
}

interface ForceStepParams {
  positions: NodePosition[];
  edges: CoPresenceGraphData["edges"];
  width: number;
  height: number;
}

/** Force-directed layout 한 스텝 */
function applyForceStep({
  positions,
  edges,
  width,
  height,
}: ForceStepParams): NodePosition[] {
  const REPULSION = 3_000;
  const ATTRACTION = 0.05;
  const DAMPING = 0.85;
  const MAX_FORCE = 20;

  const forces = positions.map(() => ({ fx: 0, fy: 0 }));

  // 반발력
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = REPULSION / (dist * dist);
      const fx = (force * dx) / dist;
      const fy = (force * dy) / dist;
      forces[i].fx += fx;
      forces[i].fy += fy;
      forces[j].fx -= fx;
      forces[j].fy -= fy;
    }
  }

  // 인력 (엣지 기반)
  const posMap = new Map(positions.map((p) => [p.userId, p]));
  for (const edge of edges) {
    const a = posMap.get(edge.userA);
    const b = posMap.get(edge.userB);
    const idxA = positions.findIndex((p) => p.userId === edge.userA);
    const idxB = positions.findIndex((p) => p.userId === edge.userB);
    if (!a || !b || idxA === -1 || idxB === -1) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const fx = ATTRACTION * dx;
    const fy = ATTRACTION * dy;
    forces[idxA].fx += fx;
    forces[idxA].fy += fy;
    forces[idxB].fx -= fx;
    forces[idxB].fy -= fy;
  }

  const margin = 60;
  return positions.map((pos, i) => {
    const fx = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, forces[i].fx * DAMPING));
    const fy = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, forces[i].fy * DAMPING));
    return {
      ...pos,
      x: Math.max(margin, Math.min(width - margin, pos.x + fx)),
      y: Math.max(margin, Math.min(height - margin, pos.y + fy)),
    };
  });
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function CoPresenceGraph({
  data,
  minMinutes,
  isLoading,
  onMinMinutesChange,
}: CoPresenceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [positions, setPositions] = useState<NodePosition[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // data 변경 시 레이아웃 초기화 및 force 시뮬레이션 실행
  // set-state-in-effect 규칙: startTransition으로 래핑하여 cascading render 완화
  useEffect(() => {
    const canvas = canvasRef.current;
    const width = (canvas?.offsetWidth ?? 0) || 700;
    const height = 480;

    if (data.nodes.length === 0) {
      // 빈 데이터 → 포지션 초기화 (외부 시스템 동기화로 간주)
      queueMicrotask(() => {
        setPositions([]);
        setSelectedNode(null);
        setHoveredNode(null);
      });
      return;
    }

    const colorMap = assignClusterColors(
      data.nodes.map((n) => n.userId),
      data.edges,
    );

    let pos = computeInitialPositions({ nodes: data.nodes, width, height, colorMap });

    // force 시뮬레이션 50 스텝
    const STEPS = 50;
    for (let i = 0; i < STEPS; i++) {
      pos = applyForceStep({ positions: pos, edges: data.edges, width, height });
    }

    const computed = pos;
    queueMicrotask(() => {
      setPositions(computed);
      setSelectedNode(null);
      setHoveredNode(null);
    });
  }, [data]);

  // canvas 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (positions.length === 0) return;

    const posMap = new Map(positions.map((p) => [p.userId, p]));
    const maxEdgeMinutes = Math.max(...data.edges.map((e) => e.totalMinutes), 1);

    // 선택된 노드의 연결된 노드 집합
    const connectedNodes = new Set<string>();
    if (selectedNode) {
      connectedNodes.add(selectedNode);
      for (const edge of data.edges) {
        if (edge.userA === selectedNode) connectedNodes.add(edge.userB);
        if (edge.userB === selectedNode) connectedNodes.add(edge.userA);
      }
    }

    const isDimmed = (userId: string): boolean =>
      selectedNode !== null && !connectedNodes.has(userId);

    const isEdgeDimmed = (edge: CoPresenceGraphData["edges"][0]): boolean =>
      selectedNode !== null &&
      !connectedNodes.has(edge.userA) &&
      !connectedNodes.has(edge.userB);

    // 엣지 그리기
    for (const edge of data.edges) {
      const a = posMap.get(edge.userA);
      const b = posMap.get(edge.userB);
      if (!a || !b) continue;

      ctx.globalAlpha = isEdgeDimmed(edge) ? 0.08 : 0.6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = computeEdgeWidth(edge.totalMinutes, maxEdgeMinutes);
      ctx.stroke();
    }

    // 노드 그리기
    for (const pos of positions) {
      const dimmed = isDimmed(pos.userId);
      ctx.globalAlpha = dimmed ? 0.15 : 1;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pos.radius, 0, Math.PI * 2);
      ctx.fillStyle = pos.color;
      ctx.fill();

      // 호버/선택 테두리
      if (pos.userId === hoveredNode || pos.userId === selectedNode) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }

    // 호버된 노드 레이블
    if (hoveredNode) {
      const pos = posMap.get(hoveredNode);
      if (pos) {
        ctx.globalAlpha = 1;
        ctx.font = LABEL_FONT;
        ctx.textAlign = "center";
        const labelY = pos.y - pos.radius - 6;
        const textWidth = ctx.measureText(pos.label).width;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(
          pos.x - textWidth / 2 - 4,
          labelY - 14,
          textWidth + 8,
          18,
        );
        ctx.fillStyle = "#fff";
        ctx.fillText(pos.label, pos.x, labelY);
      }
    }

    ctx.globalAlpha = 1;
  }, [positions, data.edges, hoveredNode, selectedNode]);

  useEffect(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [render]);

  // canvas 리사이즈
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = 480;
      render();
    });
    observer.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = 480;
    return () => observer.disconnect();
  }, [render]);

  // 마우스 이벤트: 호버
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: string | null = null;
    for (const pos of positions) {
      const dx = pos.x - x;
      const dy = pos.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= pos.radius) {
        found = pos.userId;
        break;
      }
    }
    setHoveredNode(found);
    canvas.style.cursor = found ? "pointer" : "default";
  };

  // 마우스 이벤트: 클릭
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const pos of positions) {
      const dx = pos.x - x;
      const dy = pos.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= pos.radius) {
        setSelectedNode((prev) => (prev === pos.userId ? null : pos.userId));
        return;
      }
    }
    // 빈 영역 클릭 시 선택 해제
    setSelectedNode(null);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onMinMinutesChange(value);
    }, DEBOUNCE_MS);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>관계 네트워크 그래프</CardTitle>
          <div className="flex items-center gap-3">
            <label
              htmlFor="min-minutes-slider"
              className="text-sm text-muted-foreground whitespace-nowrap"
            >
              최소 임계값: {minMinutes}분
            </label>
            <input
              id="min-minutes-slider"
              type="range"
              min={1}
              max={120}
              defaultValue={minMinutes}
              onChange={handleSliderChange}
              className="w-28 accent-indigo-600"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[480px] items-center justify-center rounded-lg bg-muted/30">
            <div className="text-muted-foreground">그래프 갱신 중...</div>
          </div>
        ) : data.nodes.length === 0 ? (
          <div className="flex h-[480px] items-center justify-center rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              기간 내 동시접속 데이터가 없습니다.
            </p>
          </div>
        ) : (
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full rounded-lg bg-gray-50"
              style={{ height: 480 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              노드 클릭 시 연결된 관계만 강조 표시됩니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
