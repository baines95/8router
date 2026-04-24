"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import {
 ReactFlow,
 Handle,
 Position,
 type Node,
 type Edge,
 type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { translate } from "@/i18n/runtime";

interface Provider {
  provider: string;
  name?: string;
}

interface ActiveRequest {
  provider: string;
  model?: string;
  account?: string;
}

function getProviderConfig(providerId: string) {
 return (AI_PROVIDERS as any)[providerId] || { color: "var(--color-muted-foreground)", name: providerId };
}

// Use local provider images from /public/providers/
function getProviderImageUrl(providerId: string) {
 return `/providers/${providerId}.png`;
}

// Custom provider node - flat and minimalist
function ProviderNode({ data }: NodeProps<any>) {
 const { label, color, imageUrl, textIcon, active, error } = data as any;
 const [imgError, setImgError] = useState(false);
 
 const borderColor = error ? "var(--color-destructive)" : active ? "var(--color-primary)" : "var(--color-border)";
 const bgColor = active ? "color-mix(in oklab, var(--color-primary) 5%, transparent)" : "var(--color-background)";
 
 return (
 <div
 className="flex items-center gap-3 px-3 py-2 rounded-md border transition-all duration-300"
 style={{
 borderColor: borderColor,
 backgroundColor: bgColor,
 minWidth: "140px",
 }}
 >
 <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0"/>
 <Handle type="target" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0"/>
 <Handle type="target" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0"/>
 <Handle type="target" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0"/>

 {/* Provider icon */}
 <div className="size-6 rounded-sm flex items-center justify-center shrink-0 bg-muted/30">
 {!imgError ? (
 <img src={imageUrl} alt={label} className="size-4 object-contain" onError={() => setImgError(true)} />
 ) : (
 <span className="text-[10px] font-medium text-muted-foreground">{textIcon}</span>
 )}
 </div>

 {/* Provider name */}
 <span
 className="text-sm font-medium truncate"
 style={{ color: error ? "var(--color-destructive)" : active ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}
 >
 {label}
 </span>

 {/* Active indicator */}
 {active && (
 <span className="relative flex size-1.5 shrink-0 ml-auto">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-primary" />
 <span className="relative inline-flex rounded-full size-1.5 bg-primary" />
 </span>
 )}
 </div>
 );
}

// Center 8Router node
function RouterNode({ data }: NodeProps<any>) {
 const { activeCount } = data as any;
 return (
 <div className="flex items-center justify-center px-4 py-2 rounded-md border border-primary/30 bg-primary/5 min-w-[120px] transition-all">
 <Handle type="source" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0"/>
 <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0"/>
 <Handle type="source" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0"/>
 <Handle type="source" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0"/>

 <img src="/favicon.svg" alt="8Router" className="size-5 mr-2 opacity-80"/>
 <span className="text-sm font-medium text-primary">8Router</span>
 {activeCount > 0 && (
 <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-medium border border-primary/20 tabular-nums">
 {activeCount}
 </span>
 )}
 </div>
 );
}

const nodeTypes = { provider: ProviderNode, router: RouterNode };

// Place N nodes evenly along an ellipse around the router center.
function buildLayout(providers: Provider[], activeSet: Set<string>, lastSet: Set<string>, errorSet: Set<string>) {
 const nodeW = 160;
 const nodeH = 40;
 const routerW = 120;
 const routerH = 40;
 const nodeGap = 24;

 const count = providers.length;

 // Compute rx so arc spacing between nodes >= nodeW + nodeGap
 const minRx = ((nodeW + nodeGap) * count) / (2 * Math.PI);
 const rx = Math.max(280, minRx);
 const ry = Math.max(180, rx * 0.55); // ellipse ratio ~0.55
 if (count === 0) {
 return {
 nodes: [{ id: "router", type: "router", position: { x: 0, y: 0 }, data: { activeCount: 0 }, draggable: false }] as Node[],
 edges: [] as Edge[],
 };
 }

 const nodes: Node[] = [];
 const edges: Edge[] = [];

 nodes.push({
 id: "router",
 type: "router",
 position: { x: -routerW / 2, y: -routerH / 2 },
 data: { activeCount: activeSet.size },
 draggable: false,
 });

 const edgeStyle = (active: boolean, last: boolean, error: boolean) => {
 if (error) return { stroke: "var(--color-destructive)", strokeWidth: 1.5, opacity: 0.8 };
 if (active) return { stroke: "var(--color-primary)", strokeWidth: 1.5, opacity: 0.8 };
 if (last) return { stroke: "var(--color-muted-foreground)", strokeWidth: 1, opacity: 0.5 };
 return { stroke: "var(--color-border)", strokeWidth: 1, opacity: 0.4 };
 };

 providers.forEach((p, i) => {
 const config = getProviderConfig(p.provider);
 const active = activeSet.has(p.provider?.toLowerCase());
 const last = !active && lastSet.has(p.provider?.toLowerCase());
 const error = !active && errorSet.has(p.provider?.toLowerCase());
 const nodeId = `provider-${p.provider}`;
 const data = {
 label: (config.name !== p.provider ? config.name : null) || p.name || p.provider,
 color: config.color || "var(--color-muted-foreground)",
 imageUrl: getProviderImageUrl(p.provider),
 textIcon: config.textIcon || (p.provider || "?").slice(0, 2).toUpperCase(),
 active,
 error
 };

 // Distribute evenly starting from top (−π/2), clockwise
 const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
 const cx = rx * Math.cos(angle);
 const cy = ry * Math.sin(angle);

 // Pick router handle closest to the node direction
 let sourceHandle, targetHandle;
 if (Math.abs(angle + Math.PI / 2) < Math.PI / 4 || Math.abs(angle - 3 * Math.PI / 2) < Math.PI / 4) {
 sourceHandle = "top"; targetHandle = "bottom";
 } else if (Math.abs(angle - Math.PI / 2) < Math.PI / 4) {
 sourceHandle = "bottom"; targetHandle = "top";
 } else if (cx > 0) {
 sourceHandle = "right"; targetHandle = "left";
 } else {
 sourceHandle = "left"; targetHandle = "right";
 }

 nodes.push({
 id: nodeId,
 type: "provider",
 position: { x: cx - nodeW / 2, y: cy - nodeH / 2 },
 data,
 draggable: false,
 });

 edges.push({
 id: `e-${nodeId}`,
 source: "router",
 sourceHandle,
 target: nodeId,
 targetHandle,
 animated: active,
 style: edgeStyle(active, last, error),
 });
 });

 return { nodes, edges };
}

interface ProviderTopologyProps {
  providers: Provider[];
  activeRequests: ActiveRequest[];
  lastProvider?: string;
  errorProvider?: string;
}

export default function ProviderTopology({ providers = [], activeRequests = [], lastProvider = "", errorProvider = "" }: ProviderTopologyProps) {
 // Serialize to stable string keys so useMemo only re-runs when values actually change
 const activeKey = useMemo(
 () => activeRequests.map((r) => r.provider?.toLowerCase()).filter(Boolean).sort().join(","),
 [activeRequests]
 );
 const lastKey = lastProvider?.toLowerCase() || "";
 const errorKey = errorProvider?.toLowerCase() || "";

 const activeSet = useMemo(() => new Set(activeKey ? activeKey.split(",") : []), [activeKey]);
 const lastSet = useMemo(() => new Set(lastKey ? [lastKey] : []), [lastKey]);
 const errorSet = useMemo(() => new Set(errorKey ? [errorKey] : []), [errorKey]);

 const { nodes, edges } = useMemo(
 () => buildLayout(providers, activeSet, lastSet, errorSet),
 [providers, activeKey, lastKey, errorKey]
 );

 // Stable key — only remount when provider list changes
 const providersKey = useMemo(
 () => providers.map((p) => p.provider).sort().join(","),
 [providers]
 );

 const rfInstance = useRef<any>(null);
 const onInit = useCallback((instance: any) => {
 rfInstance.current = instance;
 setTimeout(() => instance.fitView({ padding: 0.3 }), 50);
 }, []);

 return (
 <div className="w-full h-full bg-transparent">
 {providers.length === 0 ? (
 <div className="h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
 {translate("No providers connected")}
 </div>
 ) : (
 <ReactFlow
 key={providersKey}
 nodes={nodes}
 edges={edges}
 nodeTypes={nodeTypes as any}
 fitView
 fitViewOptions={{ padding: 0.3 }}
 onInit={onInit}
 proOptions={{ hideAttribution: true }}
 panOnDrag={false}
 zoomOnScroll={false}
 zoomOnPinch={false}
 zoomOnDoubleClick={false}
 preventScrolling={false}
 nodesDraggable={false}
 nodesConnectable={false}
 elementsSelectable={false}
 />
 )}
 </div>
 );
}
