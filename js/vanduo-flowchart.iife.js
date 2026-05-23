var VanduoFlowchart = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    FLOWCHART_EDGE_MARKERS: () => FLOWCHART_EDGE_MARKERS,
    FLOWCHART_EDGE_ROUTES: () => FLOWCHART_EDGE_ROUTES,
    FLOWCHART_NODE_TYPES: () => FLOWCHART_NODE_TYPES,
    FLOWCHART_PORTS: () => FLOWCHART_PORTS,
    VD_FLOWCHART_VERSION: () => VD_FLOWCHART_VERSION,
    VanduoFlowchart: () => VanduoFlowchart,
    VdFlowchart: () => VdFlowchart,
    destroy: () => destroy,
    destroyAll: () => destroyAll,
    init: () => init,
    instances: () => instances,
    reinit: () => reinit
  });
  var SVG_NS = "http://www.w3.org/2000/svg";
  var DEFAULT_GRID_SIZE = 24;
  var MIN_SCALE = 0.35;
  var MAX_SCALE = 3;
  var MIN_NODE_SIZE = 56;
  var MAX_NODE_SIZE = 420;
  var WORLD_EXTENT = 12e3;
  var RESIZE_HANDLES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  var DEFAULT_EDGE_STROKE_WIDTH = 2.25;
  var MIN_EDGE_STROKE_WIDTH = 1.25;
  var MAX_EDGE_STROKE_WIDTH = 6;
  var CONNECTION_PORT_RADIUS = 6;
  var CONNECTION_PORT_HIT_RADIUS = 14;
  var RECONNECT_ENDPOINT_RADIUS = 7;
  var RECONNECT_ENDPOINT_HIT_RADIUS = 12;
  var EDGE_HIT_STROKE_MIN = 16;
  var CONNECTION_SNAP_PADDING = 36;
  var CONNECTION_HYSTERESIS = 16;
  var CONNECTION_CENTER_LOCK_RADIUS = 18;
  var RESIZE_PORT_GAP = 34;
  var EDGE_STROKE_PRESETS = [
    { id: "thin", label: "Thin", width: 1.75 },
    { id: "medium", label: "Medium", width: DEFAULT_EDGE_STROKE_WIDTH },
    { id: "bold", label: "Bold", width: 3.5 }
  ];
  var VD_FLOWCHART_VERSION = "0.0.1";
  var FLOWCHART_NODE_TYPES = [
    "rounded-rect",
    "rect",
    "diamond",
    "circle",
    "textbox",
    "label",
    "junction"
  ];
  var FLOWCHART_PORTS = ["top", "right", "bottom", "left"];
  var FLOWCHART_EDGE_MARKERS = ["none", "arrow", "dot"];
  var FLOWCHART_EDGE_ROUTES = ["curve", "straight", "orthogonal"];
  var DEFAULT_EDGE_ROUTE = "curve";
  var ORTHOGONAL_STUB_LENGTH = 32;
  var FLOWCHART_EDGE_ROUTE_LABELS = {
    curve: "Curve",
    straight: "Straight",
    orthogonal: "Stepped orthogonal"
  };
  var DEFAULT_NODE_SPECS = {
    "rounded-rect": { width: 180, height: 96, text: "Step" },
    rect: { width: 180, height: 96, text: "Process" },
    diamond: { width: 184, height: 120, text: "Decision" },
    circle: { width: 128, height: 128, text: "Start" },
    textbox: { width: 240, height: 144, text: "Notes" },
    label: { width: 180, height: 72, text: "Label" },
    junction: {
      width: 28,
      height: 28,
      text: "",
      minWidth: 28,
      minHeight: 28,
      maxWidth: 28,
      maxHeight: 28,
      resizable: false,
      textEditable: false
    }
  };
  var FLOWCHART_PALETTE_ITEMS = [
    { kind: "tool", tool: "arrow", label: "arrow" },
    { kind: "node", type: "rounded-rect", label: "rounded rect" },
    { kind: "node", type: "rect", label: "rect" },
    { kind: "node", type: "diamond", label: "diamond" },
    { kind: "node", type: "circle", label: "circle" },
    { kind: "node", type: "junction", label: "junction" },
    { kind: "node", type: "textbox", label: "textbox" },
    { kind: "node", type: "label", label: "label" }
  ];
  var flowchartId = 0;
  function nextId(prefix) {
    flowchartId += 1;
    return `${prefix}-${flowchartId}`;
  }
  function hasWindow() {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }
  function isElement(value) {
    return hasWindow() && value instanceof Element;
  }
  function isPlainObject(value) {
    return Boolean(value) && Object.prototype.toString.call(value) === "[object Object]";
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function toFiniteNumber(value, fallback) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }
  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function formatNumber(value) {
    return Number(value.toFixed(2));
  }
  function sanitizeId(value) {
    if (value == null) return "";
    return String(value).trim();
  }
  function resolveElement(target) {
    if (!hasWindow()) {
      throw new Error("Vanduo Flowchart requires a browser DOM target.");
    }
    if (typeof target === "string") {
      const el = document.querySelector(target);
      if (!el) throw new Error(`Flowchart target not found: ${target}`);
      return el;
    }
    if (isElement(target)) return target;
    throw new Error("Flowchart target must be an Element or selector string.");
  }
  function normalizeRoot(root) {
    if (!hasWindow()) return null;
    if (root === document || root instanceof Element || root instanceof DocumentFragment) {
      return root;
    }
    return document;
  }
  function queryAll(root, selector) {
    const scope = normalizeRoot(root);
    if (!scope) return [];
    if (window.Vanduo && typeof window.Vanduo.queryAll === "function") {
      return window.Vanduo.queryAll(scope, selector);
    }
    const matches = [];
    if (scope instanceof Element && scope.matches(selector)) {
      matches.push(scope);
    }
    if (typeof scope.querySelectorAll === "function") {
      scope.querySelectorAll(selector).forEach((element) => matches.push(element));
    }
    return matches;
  }
  function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    if (options.className) element.className = options.className;
    if (options.text != null) element.textContent = String(options.text);
    if (options.type) element.type = options.type;
    if (options.value != null) element.value = String(options.value);
    if (options.placeholder != null) element.placeholder = String(options.placeholder);
    if (options.title != null) element.title = String(options.title);
    if (options.rows != null) element.rows = Number(options.rows);
    if (options.disabled) element.disabled = true;
    if (options.tabIndex != null) element.tabIndex = Number(options.tabIndex);
    return element;
  }
  function svgEl(name, attrs = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value != null) {
        element.setAttribute(key, String(value));
      }
    });
    return element;
  }
  function clearChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }
  function ensureUniqueId(preferred, prefix, usedIds) {
    let candidate = sanitizeId(preferred) || nextId(prefix);
    while (usedIds.has(candidate)) {
      candidate = nextId(prefix);
    }
    usedIds.add(candidate);
    return candidate;
  }
  function normalizeNodeType(type) {
    return FLOWCHART_NODE_TYPES.includes(type) ? type : "rounded-rect";
  }
  function getNodeSpec(type) {
    return DEFAULT_NODE_SPECS[normalizeNodeType(type)];
  }
  function getNodeSizeBounds(type) {
    const spec = getNodeSpec(type);
    return {
      minWidth: spec.minWidth ?? MIN_NODE_SIZE,
      minHeight: spec.minHeight ?? MIN_NODE_SIZE,
      maxWidth: spec.maxWidth ?? MAX_NODE_SIZE,
      maxHeight: spec.maxHeight ?? MAX_NODE_SIZE
    };
  }
  function clampNodeWidth(type, width, fallback) {
    const bounds = getNodeSizeBounds(type);
    return clamp(toFiniteNumber(width, fallback), bounds.minWidth, bounds.maxWidth);
  }
  function clampNodeHeight(type, height, fallback) {
    const bounds = getNodeSizeBounds(type);
    return clamp(toFiniteNumber(height, fallback), bounds.minHeight, bounds.maxHeight);
  }
  function isNodeResizable(nodeOrType) {
    const spec = typeof nodeOrType === "string" ? getNodeSpec(nodeOrType) : getNodeSpec(nodeOrType?.type);
    return spec.resizable !== false;
  }
  function isNodeTextEditable(nodeOrType) {
    const spec = typeof nodeOrType === "string" ? getNodeSpec(nodeOrType) : getNodeSpec(nodeOrType?.type);
    return spec.textEditable !== false;
  }
  function normalizeEdgeStrokeWidth(value) {
    const next = Number(value);
    if (!Number.isFinite(next)) return DEFAULT_EDGE_STROKE_WIDTH;
    return formatNumber(clamp(next, MIN_EDGE_STROKE_WIDTH, MAX_EDGE_STROKE_WIDTH));
  }
  function getStrokePresetId(strokeWidth) {
    const match = EDGE_STROKE_PRESETS.find((preset) => Math.abs(preset.width - strokeWidth) < 0.01);
    return match?.id || "medium";
  }
  function getStrokePresetWidth(presetId) {
    const preset = EDGE_STROKE_PRESETS.find((item) => item.id === presetId);
    return preset?.width ?? DEFAULT_EDGE_STROKE_WIDTH;
  }
  function normalizeViewport(viewport) {
    return {
      x: toFiniteNumber(viewport?.x, 0),
      y: toFiniteNumber(viewport?.y, 0),
      scale: clamp(toFiniteNumber(viewport?.scale, 1), MIN_SCALE, MAX_SCALE)
    };
  }
  function normalizeNode(rawNode, index, usedIds) {
    const type = normalizeNodeType(rawNode?.type);
    const spec = getNodeSpec(type);
    return {
      id: ensureUniqueId(rawNode?.id, "node", usedIds),
      type,
      x: toFiniteNumber(rawNode?.x, index * 28),
      y: toFiniteNumber(rawNode?.y, index * 18),
      width: clampNodeWidth(type, rawNode?.width, spec.width),
      height: clampNodeHeight(type, rawNode?.height, spec.height),
      text: rawNode?.text == null ? spec.text : String(rawNode.text),
      data: isPlainObject(rawNode?.data) ? deepClone(rawNode.data) : {}
    };
  }
  function normalizeEndpoint(rawEndpoint, fallbackPort) {
    return {
      nodeId: sanitizeId(rawEndpoint?.nodeId),
      port: FLOWCHART_PORTS.includes(rawEndpoint?.port) ? rawEndpoint.port : fallbackPort
    };
  }
  function normalizeEdgeMarker(value) {
    return FLOWCHART_EDGE_MARKERS.includes(value) ? value : null;
  }
  function normalizeEdgeRoute(value) {
    return FLOWCHART_EDGE_ROUTES.includes(value) ? value : DEFAULT_EDGE_ROUTE;
  }
  function syncEdgeKind(edge) {
    edge.kind = edge.startMarker === "none" && edge.endMarker === "none" ? "line" : "arrow";
  }
  function normalizeEdge(rawEdge, index, nodeIds, usedIds) {
    const from = normalizeEndpoint(rawEdge?.from, "right");
    const to = normalizeEndpoint(rawEdge?.to, "left");
    if (!from.nodeId || !to.nodeId) return null;
    if (!nodeIds.has(from.nodeId) || !nodeIds.has(to.nodeId)) return null;
    if (!FLOWCHART_PORTS.includes(from.port) || !FLOWCHART_PORTS.includes(to.port)) return null;
    const legacyKind = rawEdge?.kind === "line" ? "line" : "arrow";
    const startMarker = normalizeEdgeMarker(rawEdge?.startMarker) ?? (legacyKind === "line" ? "none" : "none");
    const endMarker = normalizeEdgeMarker(rawEdge?.endMarker) ?? (legacyKind === "line" ? "none" : "arrow");
    const edge = {
      id: ensureUniqueId(rawEdge?.id, "edge", usedIds),
      from,
      to,
      kind: legacyKind,
      startMarker,
      endMarker,
      strokeWidth: normalizeEdgeStrokeWidth(rawEdge?.strokeWidth),
      route: normalizeEdgeRoute(rawEdge?.route),
      label: rawEdge?.label == null ? "" : String(rawEdge.label),
      data: isPlainObject(rawEdge?.data) ? deepClone(rawEdge.data) : {}
    };
    syncEdgeKind(edge);
    return edge;
  }
  function normalizeDocument(input) {
    let source = input;
    if (typeof source === "string") {
      try {
        source = JSON.parse(source);
      } catch (_error) {
        source = {};
      }
    }
    if (!isPlainObject(source)) {
      source = {};
    }
    const usedNodeIds = /* @__PURE__ */ new Set();
    const nodes = (Array.isArray(source.nodes) ? source.nodes : []).map(
      (node, index) => normalizeNode(node, index, usedNodeIds)
    );
    const nodeIds = new Set(nodes.map((node) => node.id));
    const usedEdgeIds = /* @__PURE__ */ new Set();
    const edges = (Array.isArray(source.edges) ? source.edges : []).map((edge, index) => normalizeEdge(edge, index, nodeIds, usedEdgeIds)).filter(Boolean);
    return {
      version: VD_FLOWCHART_VERSION,
      viewport: normalizeViewport(source.viewport),
      nodes,
      edges
    };
  }
  function splitLongToken(token, maxChars) {
    const result = [];
    let index = 0;
    while (index < token.length) {
      result.push(token.slice(index, index + maxChars));
      index += maxChars;
    }
    return result;
  }
  function wrapText(text, maxChars) {
    const safeMaxChars = Math.max(6, maxChars);
    const lines = [];
    String(text || "").split(/\r?\n/).forEach((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) {
        lines.push("");
        return;
      }
      let current = "";
      trimmed.split(/\s+/).forEach((word) => {
        if (word.length > safeMaxChars) {
          if (current) {
            lines.push(current);
            current = "";
          }
          splitLongToken(word, safeMaxChars).forEach((chunk) => lines.push(chunk));
          return;
        }
        const next = current ? `${current} ${word}` : word;
        if (next.length <= safeMaxChars) {
          current = next;
          return;
        }
        if (current) lines.push(current);
        current = word;
      });
      if (current) lines.push(current);
    });
    if (!lines.length) return [""];
    if (lines.length <= 6) return lines;
    const clipped = lines.slice(0, 6);
    clipped[5] = clipped[5].length > safeMaxChars - 3 ? `${clipped[5].slice(0, safeMaxChars - 3)}...` : `${clipped[5]}...`;
    return clipped;
  }
  function estimateChars(width) {
    return Math.max(8, Math.floor((width - 24) / 7));
  }
  function getPortPosition(node, port) {
    switch (port) {
      case "top":
        return { x: node.x + node.width / 2, y: node.y };
      case "right":
        return { x: node.x + node.width, y: node.y + node.height / 2 };
      case "bottom":
        return { x: node.x + node.width / 2, y: node.y + node.height };
      case "left":
      default:
        return { x: node.x, y: node.y + node.height / 2 };
    }
  }
  function getNearestPort(node, point) {
    return FLOWCHART_PORTS.reduce((best, port) => {
      const portPoint = getPortPosition(node, port);
      const distance = Math.hypot(point.x - portPoint.x, point.y - portPoint.y);
      if (!best || distance < best.distance) {
        return { port, point: portPoint, distance };
      }
      return best;
    }, null);
  }
  function getPortNormal(port) {
    switch (port) {
      case "top":
        return { x: 0, y: -1 };
      case "right":
        return { x: 1, y: 0 };
      case "bottom":
        return { x: 0, y: 1 };
      case "left":
      default:
        return { x: -1, y: 0 };
    }
  }
  function isPointInsideNode(node, point) {
    return point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height;
  }
  function getPortByDirection(node, point) {
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;
    const deltaX = point.x - centerX;
    const deltaY = point.y - centerY;
    const port = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX > 0 ? "right" : "left" : deltaY > 0 ? "bottom" : "top";
    const portPoint = getPortPosition(node, port);
    return {
      port,
      point: portPoint,
      distance: Math.hypot(point.x - portPoint.x, point.y - portPoint.y)
    };
  }
  function pickPortForNode(node, point, referencePoint = null) {
    if (isPointInsideNode(node, point)) {
      const centerX = node.x + node.width / 2;
      const centerY = node.y + node.height / 2;
      const distanceFromCenter = Math.hypot(point.x - centerX, point.y - centerY);
      if (referencePoint && distanceFromCenter <= CONNECTION_CENTER_LOCK_RADIUS) {
        return getPortByDirection(node, referencePoint);
      }
      return getPortByDirection(node, point);
    }
    return getNearestPort(node, point);
  }
  function getDistanceToNodeBounds(node, point) {
    const left = node.x;
    const right = node.x + node.width;
    const top = node.y;
    const bottom = node.y + node.height;
    const dx = point.x < left ? left - point.x : point.x > right ? point.x - right : 0;
    const dy = point.y < top ? top - point.y : point.y > bottom ? point.y - bottom : 0;
    return Math.hypot(dx, dy);
  }
  function offsetPoint(point, normal, distance) {
    return {
      x: point.x + normal.x * distance,
      y: point.y + normal.y * distance
    };
  }
  function isHorizontalPort(port) {
    return port === "left" || port === "right";
  }
  function addDistinctPoint(points, point) {
    const previous = points[points.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      points.push(point);
    }
  }
  function buildPathFromPoints(points) {
    return points.map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${formatNumber(point.x)} ${formatNumber(point.y)}`;
    }).join(" ");
  }
  function getPolylineLabelPoint(points) {
    let totalLength = 0;
    for (let index = 1; index < points.length; index += 1) {
      totalLength += Math.hypot(
        points[index].x - points[index - 1].x,
        points[index].y - points[index - 1].y
      );
    }
    if (!totalLength) {
      const first = points[0] || { x: 0, y: 0 };
      return { x: formatNumber(first.x), y: formatNumber(first.y) };
    }
    const halfway = totalLength / 2;
    let covered = 0;
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
      if (!segmentLength) continue;
      if (covered + segmentLength >= halfway) {
        const ratio = (halfway - covered) / segmentLength;
        return {
          x: formatNumber(start.x + (end.x - start.x) * ratio),
          y: formatNumber(start.y + (end.y - start.y) * ratio)
        };
      }
      covered += segmentLength;
    }
    const last = points[points.length - 1] || { x: 0, y: 0 };
    return { x: formatNumber(last.x), y: formatNumber(last.y) };
  }
  function buildCurvePath(fromPoint, toPoint, fromPort = "right", toPort = "left") {
    const fromNormal = getPortNormal(fromPort);
    const toNormal = getPortNormal(toPort);
    const deltaX = Math.abs(toPoint.x - fromPoint.x);
    const deltaY = Math.abs(toPoint.y - fromPoint.y);
    const bend = Math.max(48, Math.max(deltaX, deltaY) * 0.45);
    const controlA = {
      x: fromPoint.x + fromNormal.x * bend,
      y: fromPoint.y + fromNormal.y * bend
    };
    const controlB = {
      x: toPoint.x - toNormal.x * bend,
      y: toPoint.y - toNormal.y * bend
    };
    return {
      d: `M ${formatNumber(fromPoint.x)} ${formatNumber(fromPoint.y)} C ${formatNumber(controlA.x)} ${formatNumber(controlA.y)} ${formatNumber(controlB.x)} ${formatNumber(controlB.y)} ${formatNumber(toPoint.x)} ${formatNumber(toPoint.y)}`,
      labelX: formatNumber((fromPoint.x + toPoint.x) / 2),
      labelY: formatNumber((fromPoint.y + toPoint.y) / 2)
    };
  }
  function buildStraightPath(fromPoint, toPoint) {
    return {
      d: buildPathFromPoints([fromPoint, toPoint]),
      labelX: formatNumber((fromPoint.x + toPoint.x) / 2),
      labelY: formatNumber((fromPoint.y + toPoint.y) / 2)
    };
  }
  function getOrthogonalMidpoints(fromStub, toStub, fromPort, toPort) {
    const sourceHorizontal = isHorizontalPort(fromPort);
    const targetHorizontal = isHorizontalPort(toPort);
    if (sourceHorizontal && targetHorizontal) {
      const midX = (fromStub.x + toStub.x) / 2;
      return [
        { x: midX, y: fromStub.y },
        { x: midX, y: toStub.y }
      ];
    }
    if (!sourceHorizontal && !targetHorizontal) {
      const midY = (fromStub.y + toStub.y) / 2;
      return [
        { x: fromStub.x, y: midY },
        { x: toStub.x, y: midY }
      ];
    }
    if (sourceHorizontal) {
      return [{ x: toStub.x, y: fromStub.y }];
    }
    return [{ x: fromStub.x, y: toStub.y }];
  }
  function buildOrthogonalPath(fromPoint, toPoint, fromPort = "right", toPort = "left") {
    const fromStub = offsetPoint(fromPoint, getPortNormal(fromPort), ORTHOGONAL_STUB_LENGTH);
    const toStub = offsetPoint(toPoint, getPortNormal(toPort), ORTHOGONAL_STUB_LENGTH);
    const points = [];
    [
      fromPoint,
      fromStub,
      ...getOrthogonalMidpoints(fromStub, toStub, fromPort, toPort),
      toStub,
      toPoint
    ].forEach((point) => addDistinctPoint(points, point));
    const label = getPolylineLabelPoint(points);
    return {
      d: buildPathFromPoints(points),
      labelX: label.x,
      labelY: label.y
    };
  }
  function buildEdgePath(edge, fromNode = null, toNode = null) {
    const fromPort = edge?.from?.port || edge?.fromPort || "right";
    const toPort = edge?.to?.port || edge?.toPort || "left";
    const fromPoint = edge?.fromPoint || (fromNode ? getPortPosition(fromNode, fromPort) : null);
    const toPoint = edge?.toPoint || (toNode ? getPortPosition(toNode, toPort) : null);
    const route = normalizeEdgeRoute(edge?.route);
    if (!fromPoint || !toPoint) {
      return { d: "", labelX: 0, labelY: 0 };
    }
    if (route === "straight") {
      return buildStraightPath(fromPoint, toPoint);
    }
    if (route === "orthogonal") {
      return buildOrthogonalPath(fromPoint, toPoint, fromPort, toPort);
    }
    return buildCurvePath(fromPoint, toPoint, fromPort, toPort);
  }
  function createArrowMarker(id, strokeWidth, reversed = false) {
    const size = formatNumber(Math.max(9, strokeWidth * 4.4));
    const refInset = formatNumber(Math.max(1.5, strokeWidth * 0.85));
    const marker = svgEl("marker", {
      id,
      markerWidth: size,
      markerHeight: size,
      refX: reversed ? refInset : formatNumber(size - refInset),
      refY: formatNumber(size / 2),
      orient: "auto",
      markerUnits: "userSpaceOnUse"
    });
    marker.appendChild(svgEl("path", {
      d: reversed ? `M ${formatNumber(size)} 0 L 0 ${formatNumber(size / 2)} L ${formatNumber(size)} ${formatNumber(size)} z` : `M 0 0 L ${formatNumber(size)} ${formatNumber(size / 2)} L 0 ${formatNumber(size)} z`,
      fill: "var(--vd-flowchart-accent)"
    }));
    return marker;
  }
  function createDotMarker(id, strokeWidth) {
    const size = formatNumber(Math.max(8, strokeWidth * 3.3));
    const radius = formatNumber(Math.max(2.75, strokeWidth * 1.45));
    const marker = svgEl("marker", {
      id,
      markerWidth: size,
      markerHeight: size,
      refX: formatNumber(size / 2),
      refY: formatNumber(size / 2),
      orient: "auto",
      markerUnits: "userSpaceOnUse"
    });
    marker.appendChild(svgEl("circle", {
      cx: formatNumber(size / 2),
      cy: formatNumber(size / 2),
      r: radius,
      fill: "var(--vd-flowchart-accent)"
    }));
    return marker;
  }
  function getNodeFontMetrics(node) {
    if (node.type === "label") {
      return { fontSize: 18, lineHeight: 20 };
    }
    if (node.type === "textbox") {
      return { fontSize: 13, lineHeight: 18 };
    }
    return { fontSize: 14, lineHeight: 18 };
  }
  function getResizeHandlePosition(node, handle) {
    const middleX = node.width / 2;
    const middleY = node.height / 2;
    const x = handle.includes("w") ? 0 : handle.includes("e") ? node.width : middleX;
    const y = handle.includes("n") ? 0 : handle.includes("s") ? node.height : middleY;
    return { x, y };
  }
  function getResizeCursor(handle) {
    if (handle === "n" || handle === "s") return "ns-resize";
    if (handle === "e" || handle === "w") return "ew-resize";
    if (handle === "ne" || handle === "sw") return "nesw-resize";
    return "nwse-resize";
  }
  function getBounds(nodes) {
    if (!nodes.length) {
      return { left: 0, top: 0, right: 0, bottom: 0 };
    }
    return nodes.reduce((accumulator, node) => ({
      left: Math.min(accumulator.left, node.x),
      top: Math.min(accumulator.top, node.y),
      right: Math.max(accumulator.right, node.x + node.width),
      bottom: Math.max(accumulator.bottom, node.y + node.height)
    }), {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY
    });
  }
  function parseFlowchartData(text, context) {
    if (!text) return { nodes: [], edges: [] };
    try {
      const parsed = JSON.parse(text);
      return isPlainObject(parsed) ? parsed : { nodes: [], edges: [] };
    } catch (error) {
      console.warn(`[Vanduo Flowchart] Failed to parse flowchart data${context ? ` from ${context}` : ""}:`, error);
      return { nodes: [], edges: [] };
    }
  }
  function readAutoData(element) {
    const source = element.getAttribute("data-vd-flowchart-data");
    if (!source) return parseFlowchartData(element.textContent.trim(), "element text");
    if (source.trim().startsWith("#")) {
      const script = document.querySelector(source.trim());
      return script ? parseFlowchartData(script.textContent, source.trim()) : { nodes: [], edges: [] };
    }
    return parseFlowchartData(source, "data-vd-flowchart-data");
  }
  function parseBooleanAttribute(value) {
    if (value == null) return false;
    const normalized = String(value).trim().toLowerCase();
    return normalized === "" || normalized === "true" || normalized === "1" || normalized === "yes";
  }
  function parseNumberAttribute(element, name, fallback) {
    const value = element.getAttribute(name);
    if (value == null || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function createField(labelText, control) {
    const wrapper = createElement("div", { className: "vd-flowchart-field" });
    const label = createElement("label", { text: labelText });
    wrapper.appendChild(label);
    wrapper.appendChild(control);
    return wrapper;
  }
  function createPalettePreview(type) {
    const preview = svgEl("svg", {
      class: `vd-flowchart-palette-preview vd-flowchart-palette-preview--${type}`,
      viewBox: "0 0 72 44",
      "aria-hidden": "true",
      focusable: "false"
    });
    const baseClass = `vd-flowchart-palette-shape vd-flowchart-palette-shape--${type}`;
    if (type === "arrow") {
      preview.appendChild(svgEl("path", {
        class: "vd-flowchart-palette-arrow",
        d: "M 12 30 C 28 10 44 10 60 22"
      }));
      preview.appendChild(svgEl("path", {
        class: "vd-flowchart-palette-arrowhead",
        d: "M 53 16 L 64 22 L 52 27 z"
      }));
      return preview;
    }
    if (type === "rounded-rect") {
      preview.appendChild(svgEl("rect", {
        class: baseClass,
        x: 10,
        y: 10,
        width: 52,
        height: 24,
        rx: 8,
        ry: 8
      }));
      return preview;
    }
    if (type === "rect") {
      preview.appendChild(svgEl("rect", {
        class: baseClass,
        x: 10,
        y: 10,
        width: 52,
        height: 24,
        rx: 1,
        ry: 1
      }));
      return preview;
    }
    if (type === "diamond") {
      preview.appendChild(svgEl("polygon", {
        class: baseClass,
        points: "36,6 64,22 36,38 8,22"
      }));
      return preview;
    }
    if (type === "circle") {
      preview.appendChild(svgEl("ellipse", {
        class: baseClass,
        cx: 36,
        cy: 22,
        rx: 18,
        ry: 18
      }));
      return preview;
    }
    if (type === "junction") {
      preview.appendChild(svgEl("path", {
        class: "vd-flowchart-palette-junction-lines",
        d: "M 12 22 H 27 M 45 22 H 60 M 36 8 V 14 M 36 30 V 36"
      }));
      preview.appendChild(svgEl("circle", {
        class: baseClass,
        cx: 36,
        cy: 22,
        r: 8
      }));
      return preview;
    }
    if (type === "textbox") {
      preview.appendChild(svgEl("rect", {
        class: baseClass,
        x: 10,
        y: 8,
        width: 52,
        height: 28,
        rx: 6,
        ry: 6
      }));
      preview.appendChild(svgEl("path", {
        class: "vd-flowchart-palette-lines",
        d: "M 20 18 H 52 M 20 25 H 46"
      }));
      return preview;
    }
    const label = svgEl("text", {
      class: "vd-flowchart-palette-label-mark",
      x: 36,
      y: 24,
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
    label.textContent = "Aa";
    preview.appendChild(label);
    return preview;
  }
  var VdFlowchart = class {
    constructor(options = {}) {
      this.element = resolveElement(options.element || options.target);
      this.readonly = Boolean(options.readonly);
      this.gridSize = clamp(toFiniteNumber(options.gridSize, DEFAULT_GRID_SIZE), 12, 64);
      this.documentData = normalizeDocument(options.data || {});
      this.listeners = {};
      this.selection = null;
      this.interaction = null;
      this.activeTool = null;
      this.paletteSerial = 0;
      this.destroyed = false;
      this.lastNodePointer = null;
      this.reconnectEdgeId = null;
      this.clipboard = null;
      this.gridPatternId = nextId("flowchart-grid");
      this.markerIds = /* @__PURE__ */ new Map();
      this.textEditor = null;
      this.handleToolbarClick = this.handleToolbarClick.bind(this);
      this.handlePaletteClick = this.handlePaletteClick.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleDoubleClick = this.handleDoubleClick.bind(this);
      this.handleWheel = this.handleWheel.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleSelectionFieldInput = this.handleSelectionFieldInput.bind(this);
      this.handleSelectionFieldChange = this.handleSelectionFieldChange.bind(this);
      this.handleJsonActionClick = this.handleJsonActionClick.bind(this);
      this.handleResize = this.handleResize.bind(this);
      this.buildShell();
      this.bindEvents();
      this.render();
    }
    buildShell() {
      this.element.innerHTML = "";
      this.element.classList.add("vd-flowchart-host");
      this.root = createElement("div", {
        className: `vd-flowchart-shell${this.readonly ? " vd-flowchart-readonly" : ""}`
      });
      this.toolbar = createElement("div", { className: "vd-flowchart-toolbar" });
      const toolbarLeft = createElement("div", { className: "vd-flowchart-toolbar-group" });
      const toolbarRight = createElement("div", { className: "vd-flowchart-toolbar-group" });
      this.zoomOutButton = createElement("button", { className: "vd-flowchart-btn", text: "-" });
      this.zoomOutButton.setAttribute("data-flowchart-action", "zoom-out");
      this.zoomOutButton.setAttribute("type", "button");
      this.zoomInButton = createElement("button", { className: "vd-flowchart-btn", text: "+" });
      this.zoomInButton.setAttribute("data-flowchart-action", "zoom-in");
      this.zoomInButton.setAttribute("type", "button");
      this.resetViewButton = createElement("button", { className: "vd-flowchart-btn", text: "Reset" });
      this.resetViewButton.setAttribute("data-flowchart-action", "reset-view");
      this.resetViewButton.setAttribute("type", "button");
      this.fitViewButton = createElement("button", { className: "vd-flowchart-btn", text: "Fit" });
      this.fitViewButton.setAttribute("data-flowchart-action", "fit-view");
      this.fitViewButton.setAttribute("type", "button");
      this.clearButton = createElement("button", { className: "vd-flowchart-btn", text: "Clear", disabled: this.readonly });
      this.clearButton.setAttribute("data-flowchart-action", "clear");
      this.clearButton.setAttribute("type", "button");
      this.zoomLabel = createElement("span", { className: "vd-flowchart-toolbar-label", text: "100%" });
      toolbarLeft.appendChild(this.zoomOutButton);
      toolbarLeft.appendChild(this.zoomInButton);
      toolbarLeft.appendChild(this.resetViewButton);
      toolbarLeft.appendChild(this.fitViewButton);
      toolbarLeft.appendChild(this.clearButton);
      toolbarRight.appendChild(this.zoomLabel);
      this.toolbar.appendChild(toolbarLeft);
      this.toolbar.appendChild(toolbarRight);
      this.body = createElement("div", { className: "vd-flowchart-body" });
      this.palettePanel = createElement("aside", { className: "vd-flowchart-panel vd-flowchart-panel--palette" });
      this.palettePanel.appendChild(createElement("h4", { className: "vd-flowchart-panel-title", text: "Shapes & tools" }));
      this.paletteGrid = createElement("div", { className: "vd-flowchart-palette" });
      FLOWCHART_PALETTE_ITEMS.forEach((item) => {
        const button = createElement("button", {
          className: "vd-flowchart-palette-btn"
        });
        button.setAttribute("type", "button");
        if (item.kind === "tool") {
          button.setAttribute("data-tool", item.tool);
          button.setAttribute("aria-label", `Use ${item.label}`);
        } else {
          button.setAttribute("data-node-type", item.type);
          button.setAttribute("aria-label", `Add ${item.label}`);
        }
        button.appendChild(createPalettePreview(item.tool || item.type));
        button.appendChild(createElement("span", {
          className: "vd-flowchart-palette-label",
          text: item.label
        }));
        this.paletteGrid.appendChild(button);
      });
      this.palettePanel.appendChild(this.paletteGrid);
      this.canvasEl = createElement("div", { className: "vd-flowchart-canvas", tabIndex: 0 });
      this.svg = svgEl("svg", {
        class: "vd-flowchart-svg",
        role: "img",
        "aria-label": "Vanduo Flowchart editor"
      });
      const defs = svgEl("defs");
      this.markerDefs = svgEl("g");
      defs.appendChild(this.markerDefs);
      const pattern = svgEl("pattern", {
        id: this.gridPatternId,
        width: this.gridSize,
        height: this.gridSize,
        patternUnits: "userSpaceOnUse"
      });
      pattern.appendChild(svgEl("path", {
        d: `M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}`,
        fill: "none",
        stroke: "var(--vd-flowchart-border)",
        "stroke-opacity": 0.55,
        "stroke-width": 1
      }));
      defs.appendChild(pattern);
      this.svg.appendChild(defs);
      this.world = svgEl("g", { class: "vd-flowchart-world" });
      this.gridRect = svgEl("rect", {
        class: "vd-flowchart-grid",
        x: -WORLD_EXTENT / 2,
        y: -WORLD_EXTENT / 2,
        width: WORLD_EXTENT,
        height: WORLD_EXTENT,
        fill: `url(#${this.gridPatternId})`
      });
      this.edgesLayer = svgEl("g", { class: "vd-flowchart-edges" });
      this.previewLayer = svgEl("g", { class: "vd-flowchart-preview" });
      this.nodesLayer = svgEl("g", { class: "vd-flowchart-nodes" });
      this.overlayLayer = svgEl("g", { class: "vd-flowchart-overlay" });
      this.world.appendChild(this.gridRect);
      this.world.appendChild(this.edgesLayer);
      this.world.appendChild(this.previewLayer);
      this.world.appendChild(this.nodesLayer);
      this.world.appendChild(this.overlayLayer);
      this.svg.appendChild(this.world);
      this.canvasEl.appendChild(this.svg);
      this.inspectorPanel = createElement("aside", { className: "vd-flowchart-panel vd-flowchart-panel--inspector" });
      this.inspectorPanel.appendChild(createElement("h4", { className: "vd-flowchart-panel-title", text: "Inspector" }));
      this.selectionMeta = createElement("div", { className: "vd-flowchart-selection-meta" });
      this.selectionFields = createElement("div", { className: "vd-flowchart-fields" });
      this.deleteButton = createElement("button", {
        className: "vd-flowchart-btn vd-flowchart-delete",
        text: "Delete",
        disabled: true
      });
      this.deleteButton.setAttribute("type", "button");
      this.inspectorPanel.appendChild(this.selectionMeta);
      this.inspectorPanel.appendChild(this.selectionFields);
      this.inspectorPanel.appendChild(this.deleteButton);
      this.inspectorPanel.appendChild(createElement("h4", { className: "vd-flowchart-panel-title", text: "JSON" }));
      this.jsonPanel = createElement("div", { className: "vd-flowchart-json" });
      this.jsonTextarea = createElement("textarea", { rows: 18 });
      this.jsonActions = createElement("div", { className: "vd-flowchart-json-actions" });
      this.refreshJsonButton = createElement("button", { className: "vd-flowchart-json-btn", text: "Refresh" });
      this.refreshJsonButton.setAttribute("type", "button");
      this.refreshJsonButton.setAttribute("data-json-action", "refresh");
      this.loadJsonButton = createElement("button", {
        className: "vd-flowchart-json-btn",
        text: "Load",
        disabled: this.readonly
      });
      this.loadJsonButton.setAttribute("type", "button");
      this.loadJsonButton.setAttribute("data-json-action", "load");
      this.jsonActions.appendChild(this.refreshJsonButton);
      this.jsonActions.appendChild(this.loadJsonButton);
      this.jsonPanel.appendChild(this.jsonTextarea);
      this.jsonPanel.appendChild(this.jsonActions);
      this.inspectorPanel.appendChild(this.jsonPanel);
      this.body.appendChild(this.palettePanel);
      this.body.appendChild(this.canvasEl);
      this.body.appendChild(this.inspectorPanel);
      this.root.appendChild(this.toolbar);
      this.root.appendChild(this.body);
      this.element.appendChild(this.root);
    }
    bindEvents() {
      this.toolbar.addEventListener("click", this.handleToolbarClick);
      this.paletteGrid.addEventListener("click", this.handlePaletteClick);
      this.deleteButton.addEventListener("click", () => this.deleteSelection());
      this.selectionFields.addEventListener("input", this.handleSelectionFieldInput);
      this.selectionFields.addEventListener("change", this.handleSelectionFieldChange);
      this.jsonActions.addEventListener("click", this.handleJsonActionClick);
      this.canvasEl.addEventListener("pointerdown", this.handlePointerDown);
      this.canvasEl.addEventListener("pointermove", this.handlePointerMove);
      this.canvasEl.addEventListener("pointerup", this.handlePointerUp);
      this.canvasEl.addEventListener("pointercancel", this.handlePointerUp);
      this.canvasEl.addEventListener("click", this.handleClick);
      this.canvasEl.addEventListener("dblclick", this.handleDoubleClick);
      this.canvasEl.addEventListener("wheel", this.handleWheel, { passive: false });
      this.root.addEventListener("keydown", this.handleKeyDown, true);
      window.addEventListener("pointerup", this.handlePointerUp);
      window.addEventListener("resize", this.handleResize);
    }
    unbindEvents() {
      this.toolbar.removeEventListener("click", this.handleToolbarClick);
      this.paletteGrid.removeEventListener("click", this.handlePaletteClick);
      this.selectionFields.removeEventListener("input", this.handleSelectionFieldInput);
      this.selectionFields.removeEventListener("change", this.handleSelectionFieldChange);
      this.jsonActions.removeEventListener("click", this.handleJsonActionClick);
      this.canvasEl.removeEventListener("pointerdown", this.handlePointerDown);
      this.canvasEl.removeEventListener("pointermove", this.handlePointerMove);
      this.canvasEl.removeEventListener("pointerup", this.handlePointerUp);
      this.canvasEl.removeEventListener("pointercancel", this.handlePointerUp);
      this.canvasEl.removeEventListener("click", this.handleClick);
      this.canvasEl.removeEventListener("dblclick", this.handleDoubleClick);
      this.canvasEl.removeEventListener("wheel", this.handleWheel);
      this.root.removeEventListener("keydown", this.handleKeyDown, true);
      window.removeEventListener("pointerup", this.handlePointerUp);
      window.removeEventListener("resize", this.handleResize);
    }
    handleResize() {
      if (this.destroyed) return;
      this.render({ inspector: false, json: false });
    }
    updatePaletteState() {
      const arrowArmed = this.activeTool === "arrow";
      this.paletteGrid.querySelectorAll(".vd-flowchart-palette-btn").forEach((button) => {
        const tool = button.getAttribute("data-tool");
        button.classList.toggle("is-active", Boolean(tool) && tool === this.activeTool);
      });
      this.canvasEl.classList.toggle("is-arrow-tool", arrowArmed);
    }
    setActiveTool(tool) {
      this.activeTool = tool || null;
      this.updatePaletteState();
      this.render({ scene: true, inspector: false, json: false });
    }
    handleToolbarClick(event) {
      const actionButton = event.target.closest("[data-flowchart-action]");
      if (!actionButton) return;
      const action = actionButton.getAttribute("data-flowchart-action");
      if (action === "zoom-in") this.zoomIn();
      if (action === "zoom-out") this.zoomOut();
      if (action === "reset-view") this.resetView();
      if (action === "fit-view") this.fitView();
      if (action === "clear" && !this.readonly) this.clear();
    }
    handlePaletteClick(event) {
      if (this.readonly) return;
      const toolButton = event.target.closest("[data-tool]");
      if (toolButton) {
        const tool = toolButton.getAttribute("data-tool");
        this.setActiveTool(this.activeTool === tool ? null : tool);
        return;
      }
      const button = event.target.closest("[data-node-type]");
      if (!button) return;
      this.setActiveTool(null);
      this.addNode({ type: button.getAttribute("data-node-type") });
    }
    handleJsonActionClick(event) {
      const button = event.target.closest("[data-json-action]");
      if (!button) return;
      const action = button.getAttribute("data-json-action");
      if (action === "refresh") {
        this.syncJsonTextarea(true);
        return;
      }
      if (action === "load" && !this.readonly) {
        this.load(this.jsonTextarea.value);
      }
    }
    handleSelectionFieldInput(event) {
      const field = event.target.getAttribute("data-field");
      if (!field) return;
      if (field === "node-text") {
        this.updateNode(this.selection?.id, { text: event.target.value }, { inspector: false, reason: "node:update" });
        return;
      }
      if (field === "edge-label") {
        this.updateEdge(this.selection?.id, { label: event.target.value }, { inspector: false, reason: "edge:update" });
        return;
      }
      if (field === "node-width" || field === "node-height") {
        const patch = field === "node-width" ? { width: toFiniteNumber(event.target.value, void 0) } : { height: toFiniteNumber(event.target.value, void 0) };
        this.updateNode(this.selection?.id, patch, { inspector: false, reason: "node:update" });
      }
    }
    handleSelectionFieldChange(event) {
      const field = event.target.getAttribute("data-field");
      if (!field) return;
      if (field === "node-type") {
        this.updateNode(this.selection?.id, { type: event.target.value }, { inspector: true, reason: "node:update" });
        return;
      }
      if (field === "edge-start-marker") {
        this.updateEdge(this.selection?.id, { startMarker: event.target.value }, { inspector: true, reason: "edge:update" });
        return;
      }
      if (field === "edge-end-marker") {
        this.updateEdge(this.selection?.id, { endMarker: event.target.value }, { inspector: true, reason: "edge:update" });
        return;
      }
      if (field === "edge-route") {
        this.updateEdge(this.selection?.id, { route: event.target.value }, { inspector: true, reason: "edge:update" });
        return;
      }
      if (field === "edge-stroke-preset") {
        this.updateEdge(
          this.selection?.id,
          { strokeWidth: getStrokePresetWidth(event.target.value) },
          { inspector: true, reason: "edge:update" }
        );
      }
    }
    handleKeyDown(event) {
      if (this.readonly) return;
      if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.tagName === "SELECT")) {
        return;
      }
      if (event.key === "Escape" && this.activeTool) {
        event.preventDefault();
        this.setActiveTool(null);
        return;
      }
      const modKey = event.metaKey || event.ctrlKey;
      if (modKey && event.key === "c") {
        if (this.selection) {
          event.preventDefault();
          this.copySelection();
        }
        return;
      }
      if (modKey && event.key === "v") {
        if (this.clipboard) {
          event.preventDefault();
          this.pasteClipboard();
        }
        return;
      }
      if (modKey && event.key === "x") {
        if (this.selection) {
          event.preventDefault();
          this.cutSelection();
        }
        return;
      }
      if (!this.selection) return;
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        this.deleteSelection();
      }
    }
    copySelection() {
      if (!this.selection) return false;
      if (this.selection.kind === "node") {
        const node = this.findNode(this.selection.id);
        if (!node) return false;
        this.clipboard = { kind: "node", data: deepClone(node) };
        return true;
      }
      const edge = this.findEdge(this.selection.id);
      if (!edge) return false;
      this.clipboard = { kind: "edge", data: deepClone(edge) };
      return true;
    }
    pasteClipboard() {
      if (!this.clipboard || this.readonly) return false;
      if (this.clipboard.kind === "node") {
        const usedIds2 = new Set(this.documentData.nodes.map((node2) => node2.id));
        const node = normalizeNode({
          ...this.clipboard.data,
          id: void 0,
          x: this.clipboard.data.x + 24,
          y: this.clipboard.data.y + 24
        }, this.documentData.nodes.length, usedIds2);
        this.documentData.nodes.push(node);
        this.select({ kind: "node", id: node.id });
        this.emitChange("node:add", { node: deepClone(node) });
        return true;
      }
      const usedIds = new Set(this.documentData.edges.map((edge2) => edge2.id));
      const nodeIds = new Set(this.documentData.nodes.map((node) => node.id));
      const edge = normalizeEdge({
        ...this.clipboard.data,
        id: void 0
      }, this.documentData.edges.length, nodeIds, usedIds);
      if (!edge) return false;
      this.documentData.edges.push(edge);
      this.select({ kind: "edge", id: edge.id });
      this.emitChange("edge:add", { edge: deepClone(edge) });
      return true;
    }
    cutSelection() {
      if (!this.copySelection()) return false;
      return this.deleteSelection();
    }
    handleDoubleClick(event) {
      if (this.readonly) return;
      const edgeTarget = event.target.closest("[data-edge-id]");
      if (edgeTarget && !event.target.closest("[data-edge-endpoint]")) {
        const edgeId = edgeTarget.getAttribute("data-edge-id");
        if (edgeId && this.findEdge(edgeId)) {
          this.reconnectEdgeId = edgeId;
          this.select({ kind: "edge", id: edgeId });
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      const nodeTarget = event.target.closest("[data-node-id]");
      if (!nodeTarget || event.target.closest("[data-edge-id]")) return;
      const nodeId = nodeTarget.getAttribute("data-node-id");
      if (this.startTextEdit(nodeId)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    handleClick(event) {
      if (this.readonly || event.detail < 2) return;
      const nodeTarget = event.target.closest("[data-node-id]");
      if (!nodeTarget || event.target.closest("[data-port]") || event.target.closest("[data-resize-handle]")) return;
      if (this.startTextEdit(nodeTarget.getAttribute("data-node-id"))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    handlePointerDown(event) {
      if (this.destroyed || event.button != null && event.button !== 0) return;
      if (this.textEditor && !event.target.closest(".vd-flowchart-text-editor")) {
        this.stopTextEdit({ commit: true });
      }
      this.canvasEl.focus();
      const nodeTarget = event.target.closest("[data-node-id]");
      const portTarget = event.target.closest("[data-port]");
      const resizeTarget = event.target.closest("[data-resize-handle]");
      const edgeTarget = event.target.closest("[data-edge-id]");
      const endpointTarget = event.target.closest("[data-edge-endpoint]");
      if (endpointTarget && !this.readonly) {
        const edgeId = endpointTarget.getAttribute("data-edge-id");
        const endpoint = endpointTarget.getAttribute("data-edge-endpoint");
        const edge = this.findEdge(edgeId);
        if (!edge || endpoint !== "from" && endpoint !== "to") return;
        const fromNode = this.findNode(edge.from.nodeId);
        const toNode = this.findNode(edge.to.nodeId);
        if (!fromNode || !toNode) return;
        this.reconnectEdgeId = edgeId;
        this.select({ kind: "edge", id: edgeId });
        this.interaction = {
          kind: "reconnect",
          pointerId: event.pointerId,
          edgeId,
          endpoint,
          target: null,
          previousSnap: null,
          fromPoint: getPortPosition(fromNode, edge.from.port),
          toPoint: getPortPosition(toNode, edge.to.port),
          fromPort: edge.from.port,
          toPort: edge.to.port,
          route: edge.route,
          strokeWidth: edge.strokeWidth
        };
        this.capturePointer(event.pointerId);
        this.syncConnectingState();
        this.render({ inspector: false, json: false });
        event.preventDefault();
        return;
      }
      if (nodeTarget && !portTarget && !resizeTarget && !edgeTarget && !this.readonly) {
        if (this.activeTool === "arrow") {
          this.select({ kind: "node", id: nodeTarget.getAttribute("data-node-id") });
          event.preventDefault();
          return;
        }
        const nodeId = nodeTarget.getAttribute("data-node-id");
        const now = Date.now();
        const repeatedNodeClick = this.lastNodePointer && this.lastNodePointer.nodeId === nodeId && now - this.lastNodePointer.time <= 420;
        this.lastNodePointer = { nodeId, time: now };
        if ((event.detail >= 2 || repeatedNodeClick) && this.startTextEdit(nodeId)) {
          event.preventDefault();
          return;
        }
      } else {
        this.lastNodePointer = null;
      }
      if (portTarget && !this.readonly) {
        const nodeId = portTarget.getAttribute("data-node-id");
        const port = portTarget.getAttribute("data-port");
        const node = this.findNode(nodeId);
        if (!node) return;
        const sourcePoint = getPortPosition(node, port);
        this.interaction = {
          kind: "connect",
          pointerId: event.pointerId,
          source: { nodeId, port },
          target: null,
          previousSnap: null,
          fromPoint: sourcePoint,
          toPoint: sourcePoint,
          fromPort: port,
          toPort: "left",
          route: DEFAULT_EDGE_ROUTE,
          strokeWidth: DEFAULT_EDGE_STROKE_WIDTH
        };
        this.select({ kind: "node", id: nodeId });
        this.capturePointer(event.pointerId);
        this.syncConnectingState();
        this.render({ inspector: false, json: false });
        event.preventDefault();
        return;
      }
      if (resizeTarget && !this.readonly) {
        const nodeId = resizeTarget.getAttribute("data-node-id");
        const handle = resizeTarget.getAttribute("data-resize-handle");
        const node = this.findNode(nodeId);
        if (!node || !RESIZE_HANDLES.includes(handle)) return;
        this.select({ kind: "node", id: nodeId });
        this.interaction = {
          kind: "resize-node",
          pointerId: event.pointerId,
          nodeId,
          handle,
          startWorld: this.clientToWorld(event.clientX, event.clientY),
          original: deepClone(node),
          moved: false
        };
        this.capturePointer(event.pointerId);
        event.preventDefault();
        return;
      }
      if (edgeTarget) {
        const edgeId = edgeTarget.getAttribute("data-edge-id");
        if (!this.readonly) {
          this.reconnectEdgeId = edgeId;
        } else if (this.reconnectEdgeId && this.reconnectEdgeId !== edgeId) {
          this.reconnectEdgeId = null;
        }
        this.select({ kind: "edge", id: edgeId });
        event.preventDefault();
        return;
      }
      if (nodeTarget) {
        this.reconnectEdgeId = null;
        const nodeId = nodeTarget.getAttribute("data-node-id");
        this.select({ kind: "node", id: nodeId });
        if (!this.readonly) {
          const node = this.findNode(nodeId);
          const world = this.clientToWorld(event.clientX, event.clientY);
          this.interaction = {
            kind: "drag-node",
            pointerId: event.pointerId,
            nodeId,
            offsetX: world.x - node.x,
            offsetY: world.y - node.y,
            moved: false
          };
          this.capturePointer(event.pointerId);
        }
        return;
      }
      this.select(null);
      this.reconnectEdgeId = null;
      this.interaction = {
        kind: "pan",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startViewportX: this.documentData.viewport.x,
        startViewportY: this.documentData.viewport.y,
        moved: false
      };
      this.capturePointer(event.pointerId);
      event.preventDefault();
    }
    handlePointerMove(event) {
      if (!this.interaction || this.interaction.pointerId !== event.pointerId) return;
      if (this.interaction.kind === "drag-node") {
        const node = this.findNode(this.interaction.nodeId);
        if (!node) return;
        const world = this.clientToWorld(event.clientX, event.clientY);
        const nextX = formatNumber(world.x - this.interaction.offsetX);
        const nextY = formatNumber(world.y - this.interaction.offsetY);
        if (nextX !== node.x || nextY !== node.y) {
          node.x = nextX;
          node.y = nextY;
          this.interaction.moved = true;
          this.render({ inspector: false, json: false });
        }
        return;
      }
      if (this.interaction.kind === "resize-node") {
        const node = this.findNode(this.interaction.nodeId);
        if (!node) return;
        const world = this.clientToWorld(event.clientX, event.clientY);
        const deltaX = world.x - this.interaction.startWorld.x;
        const deltaY = world.y - this.interaction.startWorld.y;
        const next = this.getResizedNodeBounds(this.interaction.original, this.interaction.handle, deltaX, deltaY);
        if (next.x !== node.x || next.y !== node.y || next.width !== node.width || next.height !== node.height) {
          node.x = next.x;
          node.y = next.y;
          node.width = next.width;
          node.height = next.height;
          this.interaction.moved = true;
          this.render({ inspector: false, json: false });
        }
        return;
      }
      if (this.interaction.kind === "pan") {
        const deltaX = event.clientX - this.interaction.startClientX;
        const deltaY = event.clientY - this.interaction.startClientY;
        this.documentData.viewport.x = formatNumber(this.interaction.startViewportX + deltaX);
        this.documentData.viewport.y = formatNumber(this.interaction.startViewportY + deltaY);
        this.interaction.moved = true;
        this.render({ inspector: false, json: false });
        return;
      }
      if (this.interaction.kind === "connect") {
        const world = this.clientToWorld(event.clientX, event.clientY);
        const snapTarget = this.findConnectionTarget(
          world,
          this.interaction.source.nodeId,
          this.interaction.previousSnap,
          this.interaction.fromPoint
        );
        if (snapTarget) {
          this.interaction.target = { nodeId: snapTarget.node.id, port: snapTarget.port };
          this.interaction.toPoint = snapTarget.point;
          this.interaction.toPort = snapTarget.port;
          this.interaction.previousSnap = { nodeId: snapTarget.node.id, port: snapTarget.port };
          this.render({ inspector: false, json: false });
          return;
        }
        this.interaction.target = null;
        this.interaction.toPoint = world;
        this.interaction.toPort = this.interaction.toPort || "left";
        this.interaction.previousSnap = null;
        this.render({ inspector: false, json: false });
        return;
      }
      if (this.interaction.kind === "reconnect") {
        const edge = this.findEdge(this.interaction.edgeId);
        if (!edge) return;
        const world = this.clientToWorld(event.clientX, event.clientY);
        const snapTarget = this.findConnectionTarget(
          world,
          null,
          this.interaction.previousSnap,
          this.interaction.endpoint === "from" ? this.interaction.toPoint : this.interaction.fromPoint
        );
        if (this.interaction.endpoint === "from") {
          const toNode = this.findNode(edge.to.nodeId);
          if (!toNode) return;
          this.interaction.toPoint = getPortPosition(toNode, edge.to.port);
          this.interaction.toPort = edge.to.port;
          if (snapTarget) {
            this.interaction.target = { nodeId: snapTarget.node.id, port: snapTarget.port };
            this.interaction.fromPoint = snapTarget.point;
            this.interaction.fromPort = snapTarget.port;
            this.interaction.previousSnap = { nodeId: snapTarget.node.id, port: snapTarget.port };
          } else {
            this.interaction.target = null;
            this.interaction.fromPoint = world;
            this.interaction.fromPort = this.interaction.fromPort || edge.from.port;
            this.interaction.previousSnap = null;
          }
        } else {
          const fromNode = this.findNode(edge.from.nodeId);
          if (!fromNode) return;
          this.interaction.fromPoint = getPortPosition(fromNode, edge.from.port);
          this.interaction.fromPort = edge.from.port;
          if (snapTarget) {
            this.interaction.target = { nodeId: snapTarget.node.id, port: snapTarget.port };
            this.interaction.toPoint = snapTarget.point;
            this.interaction.toPort = snapTarget.port;
            this.interaction.previousSnap = { nodeId: snapTarget.node.id, port: snapTarget.port };
          } else {
            this.interaction.target = null;
            this.interaction.toPoint = world;
            this.interaction.toPort = this.interaction.toPort || edge.to.port;
            this.interaction.previousSnap = null;
          }
        }
        this.render({ inspector: false, json: false });
      }
    }
    handlePointerUp(event) {
      if (!this.interaction || event.pointerId != null && this.interaction.pointerId !== event.pointerId) {
        return;
      }
      const interaction = this.interaction;
      this.interaction = null;
      this.releasePointerCapture(interaction.pointerId);
      this.syncConnectingState();
      if (interaction.kind === "resize-node") {
        if (interaction.moved) {
          const node = this.findNode(interaction.nodeId);
          this.render({ inspector: true, json: true });
          this.emitChange("node:resize", { node: deepClone(node) });
        } else {
          this.render({ inspector: false, json: false });
        }
        return;
      }
      if (interaction.kind === "drag-node") {
        if (interaction.moved) {
          this.render({ inspector: true, json: true });
          this.emitChange("node:move", { node: deepClone(this.findNode(interaction.nodeId)) });
        } else {
          this.render({ inspector: false, json: false });
        }
        return;
      }
      if (interaction.kind === "pan") {
        if (interaction.moved) {
          this.render({ inspector: false, json: true });
          this.emitViewportChange("viewport:pan");
        } else {
          this.render({ inspector: false, json: false });
        }
        return;
      }
      if (interaction.kind === "connect") {
        const world = this.clientToWorld(event.clientX || 0, event.clientY || 0);
        const snapTarget = interaction.target ? { node: this.findNode(interaction.target.nodeId), port: interaction.target.port } : this.findConnectionTarget(world, interaction.source.nodeId, interaction.previousSnap, interaction.fromPoint);
        if (snapTarget && snapTarget.node) {
          const edge = this.addEdge({
            from: interaction.source,
            to: {
              nodeId: snapTarget.node.id,
              port: snapTarget.port
            },
            strokeWidth: interaction.strokeWidth,
            endMarker: "arrow"
          });
          if (edge) {
            if (this.activeTool === "arrow") this.setActiveTool(null);
            this.syncConnectingState();
            return;
          }
        }
        if (this.activeTool === "arrow") this.setActiveTool(null);
        this.syncConnectingState();
        this.render({ inspector: false, json: false });
        return;
      }
      if (interaction.kind === "reconnect") {
        const edge = this.findEdge(interaction.edgeId);
        if (edge && interaction.target) {
          const patch = interaction.endpoint === "from" ? { from: { nodeId: interaction.target.nodeId, port: interaction.target.port } } : { to: { nodeId: interaction.target.nodeId, port: interaction.target.port } };
          const nextFrom = patch.from || edge.from;
          const nextTo = patch.to || edge.to;
          if (!(nextFrom.nodeId === nextTo.nodeId && nextFrom.port === nextTo.port)) {
            this.updateEdge(interaction.edgeId, patch, { inspector: true, reason: "edge:reconnect" });
          } else {
            this.render({ inspector: false, json: false });
          }
        } else {
          this.render({ inspector: false, json: false });
        }
        this.reconnectEdgeId = interaction.edgeId;
        this.syncConnectingState();
        return;
      }
    }
    handleWheel(event) {
      event.preventDefault();
      const local = this.clientToLocal(event.clientX, event.clientY);
      const factor = event.deltaY > 0 ? 1 / 1.12 : 1.12;
      this.scaleAround(factor, local.x, local.y, "viewport:zoom");
    }
    capturePointer(pointerId) {
      if (typeof this.canvasEl.setPointerCapture !== "function") return;
      try {
        this.canvasEl.setPointerCapture(pointerId);
      } catch (_error) {
      }
    }
    releasePointerCapture(pointerId) {
      if (typeof this.canvasEl.releasePointerCapture !== "function") return;
      try {
        this.canvasEl.releasePointerCapture(pointerId);
      } catch (_error) {
      }
    }
    syncConnectingState() {
      const connecting = this.interaction?.kind === "connect" || this.interaction?.kind === "reconnect";
      this.canvasEl.classList.toggle("is-connecting", connecting);
    }
    shouldShowNodePorts(node) {
      if (this.readonly) return false;
      if (this.interaction?.kind === "connect" || this.interaction?.kind === "reconnect") return true;
      if (this.activeTool === "arrow") return true;
      return this.selection?.kind === "node" && this.selection.id === node.id;
    }
    getMarkerId(markerType, position, strokeWidth) {
      const width = normalizeEdgeStrokeWidth(strokeWidth);
      const key = `${markerType}:${position}:${width}`;
      if (this.markerIds.has(key)) {
        return this.markerIds.get(key);
      }
      const markerId = nextId(`flowchart-${markerType}-${position}`);
      const marker = markerType === "dot" ? createDotMarker(markerId, width) : createArrowMarker(markerId, width, position === "start");
      this.markerDefs.appendChild(marker);
      this.markerIds.set(key, markerId);
      return markerId;
    }
    getEdgeStrokeWidth(edge) {
      return normalizeEdgeStrokeWidth(edge?.strokeWidth);
    }
    getEdgeHitStrokeWidth(edge) {
      return formatNumber(Math.max(EDGE_HIT_STROKE_MIN, this.getEdgeStrokeWidth(edge) + 12));
    }
    findConnectionTarget(worldPoint, excludeNodeId, previousSnap = null, referencePoint = null) {
      const snapPadding = CONNECTION_SNAP_PADDING / this.documentData.viewport.scale;
      const hysteresisMargin = CONNECTION_HYSTERESIS / this.documentData.viewport.scale;
      const best = this.documentData.nodes.reduce((candidate, node) => {
        if (node.id === excludeNodeId) return candidate;
        const distanceToBounds2 = getDistanceToNodeBounds(node, worldPoint);
        if (distanceToBounds2 > snapPadding) return candidate;
        const nearest = pickPortForNode(node, worldPoint, referencePoint);
        if (!nearest) return candidate;
        const score = distanceToBounds2 * 1e3 + nearest.distance;
        if (!candidate || score < candidate.score) {
          return {
            node,
            port: nearest.port,
            point: nearest.point,
            score
          };
        }
        return candidate;
      }, null);
      if (!previousSnap || !best) return best;
      const previousNode = this.findNode(previousSnap.nodeId);
      if (!previousNode || previousNode.id === excludeNodeId) return best;
      const distanceToBounds = getDistanceToNodeBounds(previousNode, worldPoint);
      if (distanceToBounds > snapPadding) return best;
      if (best.node.id === previousSnap.nodeId && best.port === previousSnap.port) {
        return best;
      }
      const previousPoint = getPortPosition(previousNode, previousSnap.port);
      const previousScore = distanceToBounds * 1e3 + Math.hypot(
        worldPoint.x - previousPoint.x,
        worldPoint.y - previousPoint.y
      );
      if (best.score + hysteresisMargin >= previousScore) {
        return {
          node: previousNode,
          port: previousSnap.port,
          point: previousPoint,
          score: previousScore
        };
      }
      return best;
    }
    getResizedNodeBounds(original, handle, deltaX, deltaY) {
      const nextType = original.type;
      if (!isNodeResizable(nextType)) {
        return {
          x: formatNumber(original.x),
          y: formatNumber(original.y),
          width: formatNumber(original.width),
          height: formatNumber(original.height)
        };
      }
      let x = original.x;
      let y = original.y;
      let width = original.width;
      let height = original.height;
      if (handle.includes("e")) {
        width = clampNodeWidth(nextType, original.width + deltaX, original.width);
      }
      if (handle.includes("s")) {
        height = clampNodeHeight(nextType, original.height + deltaY, original.height);
      }
      if (handle.includes("w")) {
        width = clampNodeWidth(nextType, original.width - deltaX, original.width);
        x = original.x + original.width - width;
      }
      if (handle.includes("n")) {
        height = clampNodeHeight(nextType, original.height - deltaY, original.height);
        y = original.y + original.height - height;
      }
      return {
        x: formatNumber(x),
        y: formatNumber(y),
        width: formatNumber(width),
        height: formatNumber(height)
      };
    }
    clientToLocal(clientX, clientY) {
      const rect = this.canvasEl.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }
    localToWorld(localX, localY) {
      const viewport = this.documentData.viewport;
      return {
        x: (localX - viewport.x) / viewport.scale,
        y: (localY - viewport.y) / viewport.scale
      };
    }
    clientToWorld(clientX, clientY) {
      const local = this.clientToLocal(clientX, clientY);
      return this.localToWorld(local.x, local.y);
    }
    getViewportCenter() {
      const width = this.canvasEl.clientWidth || 800;
      const height = this.canvasEl.clientHeight || 560;
      return this.localToWorld(width / 2, height / 2);
    }
    scaleAround(factor, localX, localY, reason) {
      const viewport = this.documentData.viewport;
      const anchor = this.localToWorld(localX, localY);
      const nextScale = clamp(formatNumber(viewport.scale * factor), MIN_SCALE, MAX_SCALE);
      if (nextScale === viewport.scale) return;
      viewport.scale = nextScale;
      viewport.x = formatNumber(localX - anchor.x * nextScale);
      viewport.y = formatNumber(localY - anchor.y * nextScale);
      this.render({ inspector: false, json: true });
      this.emitViewportChange(reason);
    }
    updateToolbarLabel() {
      this.zoomLabel.textContent = `${Math.round(this.documentData.viewport.scale * 100)}%`;
    }
    startTextEdit(nodeId) {
      if (this.readonly) return false;
      const node = this.findNode(nodeId);
      if (!node || !isNodeTextEditable(node)) return false;
      if (this.textEditor?.nodeId === node.id) {
        this.positionTextEditor();
        this.textEditor.textarea.focus();
        this.textEditor.textarea.select();
        return true;
      }
      this.stopTextEdit({ commit: true });
      this.select({ kind: "node", id: node.id });
      const textarea = createElement("textarea", {
        className: `vd-flowchart-text-editor vd-flowchart-text-editor--${node.type}`,
        value: node.text,
        rows: 1
      });
      textarea.setAttribute("data-node-id", node.id);
      textarea.setAttribute("aria-label", "Edit node text");
      textarea.spellcheck = false;
      textarea.addEventListener("input", () => this.positionTextEditor());
      textarea.addEventListener("pointerdown", (event) => event.stopPropagation());
      textarea.addEventListener("dblclick", (event) => event.stopPropagation());
      textarea.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.stopTextEdit({ commit: false });
          return;
        }
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          this.stopTextEdit({ commit: true });
        }
      });
      textarea.addEventListener("blur", () => {
        if (this.textEditor?.textarea === textarea) {
          this.stopTextEdit({ commit: true });
        }
      });
      this.textEditor = {
        nodeId: node.id,
        previousText: node.text,
        textarea
      };
      this.canvasEl.appendChild(textarea);
      this.render({ inspector: true, json: false });
      window.requestAnimationFrame(() => {
        if (this.textEditor?.textarea === textarea) {
          textarea.focus();
          textarea.select();
        }
      });
      return true;
    }
    stopTextEdit(options = {}) {
      if (!this.textEditor) return false;
      const commit = options.commit !== false;
      const editor = this.textEditor;
      const nextText = editor.textarea.value;
      this.textEditor = null;
      editor.textarea.remove();
      if (commit && !this.readonly && nextText !== editor.previousText) {
        this.updateNode(editor.nodeId, { text: nextText }, { inspector: true, reason: "node:update" });
      } else {
        this.render({ scene: true, inspector: false, json: false });
      }
      return true;
    }
    positionTextEditor() {
      if (!this.textEditor) return;
      const node = this.findNode(this.textEditor.nodeId);
      if (!node) {
        this.stopTextEdit({ commit: false });
        return;
      }
      const viewport = this.documentData.viewport;
      const scale = viewport.scale;
      const textarea = this.textEditor.textarea;
      const width = node.width * scale;
      const height = node.height * scale;
      const metrics = getNodeFontMetrics(node);
      const lineHeight = metrics.lineHeight * scale;
      const lineCount = Math.max(1, textarea.value.split(/\r?\n/).length);
      const horizontalPadding = (node.type === "textbox" ? 16 : 12) * scale;
      const verticalPadding = node.type === "textbox" ? 12 * scale : Math.max(4, (height - lineCount * lineHeight) / 2);
      textarea.style.left = `${formatNumber(viewport.x + node.x * scale)}px`;
      textarea.style.top = `${formatNumber(viewport.y + node.y * scale)}px`;
      textarea.style.width = `${formatNumber(width)}px`;
      textarea.style.height = `${formatNumber(height)}px`;
      textarea.style.fontSize = `${formatNumber(metrics.fontSize * scale)}px`;
      textarea.style.lineHeight = `${formatNumber(lineHeight)}px`;
      textarea.style.padding = `${formatNumber(verticalPadding)}px ${formatNumber(horizontalPadding)}px`;
    }
    render(options = {}) {
      if (this.destroyed) return;
      const shouldRenderScene = options.scene !== false;
      const shouldRenderInspector = options.inspector !== false;
      const shouldRenderJson = options.json !== false;
      if (shouldRenderScene) this.renderScene();
      if (shouldRenderInspector) this.renderSelectionPanel();
      if (shouldRenderJson) this.syncJsonTextarea();
      this.updateToolbarLabel();
      this.updatePaletteState();
      this.positionTextEditor();
    }
    renderScene() {
      const viewport = this.documentData.viewport;
      this.world.setAttribute(
        "transform",
        `matrix(${viewport.scale} 0 0 ${viewport.scale} ${viewport.x} ${viewport.y})`
      );
      clearChildren(this.edgesLayer);
      clearChildren(this.previewLayer);
      clearChildren(this.nodesLayer);
      clearChildren(this.overlayLayer);
      const nodeMap = new Map(this.documentData.nodes.map((node) => [node.id, node]));
      this.documentData.edges.forEach((edge) => {
        const edgeElement = this.renderEdge(edge, nodeMap);
        if (edgeElement) this.edgesLayer.appendChild(edgeElement);
      });
      if (this.interaction?.kind === "connect" || this.interaction?.kind === "reconnect") {
        this.previewLayer.appendChild(this.renderPreviewEdge(this.interaction));
      }
      this.documentData.nodes.forEach((node) => {
        this.nodesLayer.appendChild(this.renderNode(node));
      });
      if (this.reconnectEdgeId && !this.readonly) {
        const reconnectEdge = this.findEdge(this.reconnectEdgeId);
        if (reconnectEdge) {
          const fromNode = nodeMap.get(reconnectEdge.from.nodeId);
          const toNode = nodeMap.get(reconnectEdge.to.nodeId);
          if (fromNode && toNode) {
            this.overlayLayer.appendChild(this.renderReconnectEndpoints(reconnectEdge, fromNode, toNode));
          }
        }
      }
      this.syncConnectingState();
    }
    applyEdgeMarkers(pathElement, edge) {
      if (edge.startMarker && edge.startMarker !== "none") {
        pathElement.setAttribute(
          "marker-start",
          `url(#${this.getMarkerId(edge.startMarker, "start", this.getEdgeStrokeWidth(edge))})`
        );
      }
      if (edge.endMarker && edge.endMarker !== "none") {
        pathElement.setAttribute(
          "marker-end",
          `url(#${this.getMarkerId(edge.endMarker, "end", this.getEdgeStrokeWidth(edge))})`
        );
      }
    }
    renderEdge(edge, nodeMap) {
      const fromNode = nodeMap.get(edge.from.nodeId);
      const toNode = nodeMap.get(edge.to.nodeId);
      if (!fromNode || !toNode) return null;
      const fromPoint = getPortPosition(fromNode, edge.from.port);
      const toPoint = getPortPosition(toNode, edge.to.port);
      const edgePath = buildEdgePath(edge, fromNode, toNode);
      const selected = this.selection?.kind === "edge" && this.selection.id === edge.id;
      const inReconnectMode = this.reconnectEdgeId === edge.id;
      const group = svgEl("g", {
        class: `vd-flowchart-edge${selected ? " is-selected" : ""}${inReconnectMode ? " is-reconnecting" : ""}`,
        "data-edge-id": edge.id
      });
      const strokeWidth = this.getEdgeStrokeWidth(edge);
      if (selected) {
        group.appendChild(svgEl("path", {
          class: "vd-flowchart-edge-selection",
          d: edgePath.d,
          "stroke-width": formatNumber(strokeWidth + 7)
        }));
      }
      const visiblePath = svgEl("path", {
        class: "vd-flowchart-edge-path",
        d: edgePath.d,
        "stroke-width": strokeWidth,
        "data-edge-id": edge.id
      });
      this.applyEdgeMarkers(visiblePath, edge);
      const hitPath = svgEl("path", {
        class: "vd-flowchart-edge-hit",
        d: edgePath.d,
        "stroke-width": this.getEdgeHitStrokeWidth(edge),
        "data-edge-id": edge.id
      });
      group.appendChild(visiblePath);
      group.appendChild(hitPath);
      if (edge.label) {
        const label = svgEl("text", {
          class: "vd-flowchart-edge-label",
          x: edgePath.labelX,
          y: edgePath.labelY - 8,
          "text-anchor": "middle",
          "data-edge-id": edge.id
        });
        label.textContent = edge.label;
        group.appendChild(label);
      }
      return group;
    }
    renderReconnectEndpoints(edge, fromNode, toNode) {
      const scale = this.documentData.viewport.scale || 1;
      const group = svgEl("g", { class: "vd-flowchart-edge-endpoints" });
      [
        { endpoint: "from", point: getPortPosition(fromNode, edge.from.port) },
        { endpoint: "to", point: getPortPosition(toNode, edge.to.port) }
      ].forEach(({ endpoint, point }) => {
        group.appendChild(svgEl("circle", {
          class: "vd-flowchart-edge-endpoint-hit",
          cx: point.x,
          cy: point.y,
          r: RECONNECT_ENDPOINT_HIT_RADIUS / scale,
          "data-edge-id": edge.id,
          "data-edge-endpoint": endpoint
        }));
        group.appendChild(svgEl("circle", {
          class: "vd-flowchart-edge-endpoint",
          cx: point.x,
          cy: point.y,
          r: RECONNECT_ENDPOINT_RADIUS / scale,
          "data-edge-id": edge.id,
          "data-edge-endpoint": endpoint
        }));
      });
      return group;
    }
    renderPreviewEdge(interaction) {
      const fromPort = interaction.fromPort || interaction.source?.port || "right";
      const toPort = interaction.toPort || interaction.target?.port || "left";
      const edgePath = buildEdgePath({
        strokeWidth: interaction.strokeWidth,
        route: interaction.route,
        fromPoint: interaction.fromPoint,
        toPoint: interaction.toPoint,
        from: { port: fromPort },
        to: { port: toPort }
      });
      return svgEl("path", {
        class: "vd-flowchart-preview-path",
        d: edgePath.d,
        "stroke-width": this.getEdgeStrokeWidth(interaction)
      });
    }
    renderNode(node) {
      const selected = this.selection?.kind === "node" && this.selection.id === node.id;
      const dragging = this.interaction?.kind === "drag-node" && this.interaction.nodeId === node.id;
      const resizing = this.interaction?.kind === "resize-node" && this.interaction.nodeId === node.id;
      const editing = this.textEditor?.nodeId === node.id;
      const group = svgEl("g", {
        class: `vd-flowchart-node${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}${resizing ? " is-resizing" : ""}${editing ? " is-editing" : ""}`,
        transform: `translate(${formatNumber(node.x)} ${formatNumber(node.y)})`,
        "data-node-id": node.id
      });
      const portsVisible = this.shouldShowNodePorts(node);
      const hitbox = svgEl("rect", {
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        rx: node.type === "rounded-rect" || node.type === "textbox" ? 16 : node.type === "junction" ? node.width / 2 : 6,
        fill: "transparent",
        "data-node-id": node.id
      });
      group.appendChild(hitbox);
      group.appendChild(this.renderNodeShape(node));
      group.appendChild(this.renderNodeText(node));
      if (selected && !this.readonly && isNodeResizable(node)) {
        group.appendChild(this.renderResizeControls(node));
      }
      const scale = this.documentData.viewport.scale || 1;
      FLOWCHART_PORTS.forEach((port) => {
        const position = getPortPosition({ ...node, x: 0, y: 0 }, port);
        const portGroup = svgEl("g", {
          class: `vd-flowchart-port-group${portsVisible ? " is-visible" : ""}`,
          "data-node-id": node.id,
          "data-port": port
        });
        portGroup.appendChild(svgEl("circle", {
          class: "vd-flowchart-port-hit",
          cx: position.x,
          cy: position.y,
          r: CONNECTION_PORT_HIT_RADIUS / scale
        }));
        portGroup.appendChild(svgEl("circle", {
          class: "vd-flowchart-port",
          cx: position.x,
          cy: position.y,
          r: CONNECTION_PORT_RADIUS / scale
        }));
        group.appendChild(portGroup);
      });
      return group;
    }
    renderResizeControls(node) {
      const scale = this.documentData.viewport.scale || 1;
      const zone = 14 / scale;
      const cornerZone = 22 / scale;
      const handleSize = 9 / scale;
      const gap = RESIZE_PORT_GAP / scale;
      const group = svgEl("g", { class: "vd-flowchart-resize-controls" });
      const zones = {
        n: { x: 0, y: -zone / 2, width: node.width, height: zone },
        e: { x: node.width - zone / 2, y: 0, width: zone, height: node.height },
        s: { x: 0, y: node.height - zone / 2, width: node.width, height: zone },
        w: { x: -zone / 2, y: 0, width: zone, height: node.height },
        ne: { x: node.width - cornerZone / 2, y: -cornerZone / 2, width: cornerZone, height: cornerZone },
        se: { x: node.width - cornerZone / 2, y: node.height - cornerZone / 2, width: cornerZone, height: cornerZone },
        sw: { x: -cornerZone / 2, y: node.height - cornerZone / 2, width: cornerZone, height: cornerZone },
        nw: { x: -cornerZone / 2, y: -cornerZone / 2, width: cornerZone, height: cornerZone }
      };
      RESIZE_HANDLES.forEach((handle) => {
        const zoneRect = zones[handle];
        const position = getResizeHandlePosition(node, handle);
        const dotOffset = 8 / scale;
        if (handle.includes("e")) position.x += dotOffset;
        if (handle.includes("w")) position.x -= dotOffset;
        if (handle.includes("n")) position.y -= dotOffset;
        if (handle.includes("s")) position.y += dotOffset;
        const cursor = getResizeCursor(handle);
        const zoneSegments = [];
        if (handle === "e" || handle === "w") {
          const upperHeight = Math.max(0, node.height / 2 - gap / 2);
          const lowerY = node.height / 2 + gap / 2;
          const lowerHeight = Math.max(0, node.height - lowerY);
          zoneSegments.push(
            { x: zoneRect.x, y: zoneRect.y, width: zoneRect.width, height: upperHeight },
            { x: zoneRect.x, y: lowerY, width: zoneRect.width, height: lowerHeight }
          );
        } else if (handle === "n" || handle === "s") {
          const leftWidth = Math.max(0, node.width / 2 - gap / 2);
          const rightX = node.width / 2 + gap / 2;
          const rightWidth = Math.max(0, node.width - rightX);
          zoneSegments.push(
            { x: zoneRect.x, y: zoneRect.y, width: leftWidth, height: zoneRect.height },
            { x: rightX, y: zoneRect.y, width: rightWidth, height: zoneRect.height }
          );
        } else {
          zoneSegments.push(zoneRect);
        }
        zoneSegments.filter((segment) => segment.width > 0 && segment.height > 0).forEach((segment) => {
          const hit = svgEl("rect", {
            class: "vd-flowchart-resize-zone",
            x: segment.x,
            y: segment.y,
            width: segment.width,
            height: segment.height,
            "data-node-id": node.id,
            "data-resize-handle": handle,
            style: `cursor: ${cursor}`
          });
          group.appendChild(hit);
        });
        const dot = svgEl("rect", {
          class: "vd-flowchart-resize-handle",
          x: position.x - handleSize / 2,
          y: position.y - handleSize / 2,
          width: handleSize,
          height: handleSize,
          rx: handleSize / 3,
          ry: handleSize / 3,
          "data-node-id": node.id,
          "data-resize-handle": handle,
          style: `cursor: ${cursor}`
        });
        group.appendChild(dot);
      });
      return group;
    }
    renderNodeShape(node) {
      const baseClass = `vd-flowchart-node-shape vd-flowchart-node-shape--${node.type}`;
      if (node.type === "rounded-rect") {
        return svgEl("rect", {
          class: baseClass,
          x: 0,
          y: 0,
          width: node.width,
          height: node.height,
          rx: 18,
          ry: 18
        });
      }
      if (node.type === "rect") {
        return svgEl("rect", {
          class: baseClass,
          x: 0,
          y: 0,
          width: node.width,
          height: node.height,
          rx: 2,
          ry: 2
        });
      }
      if (node.type === "diamond") {
        return svgEl("polygon", {
          class: baseClass,
          points: `${node.width / 2},0 ${node.width},${node.height / 2} ${node.width / 2},${node.height} 0,${node.height / 2}`
        });
      }
      if (node.type === "circle") {
        return svgEl("ellipse", {
          class: baseClass,
          cx: node.width / 2,
          cy: node.height / 2,
          rx: node.width / 2,
          ry: node.height / 2
        });
      }
      if (node.type === "junction") {
        return svgEl("circle", {
          class: baseClass,
          cx: node.width / 2,
          cy: node.height / 2,
          r: Math.min(node.width, node.height) / 2
        });
      }
      if (node.type === "textbox") {
        return svgEl("rect", {
          class: baseClass,
          x: 0,
          y: 0,
          width: node.width,
          height: node.height,
          rx: 14,
          ry: 14
        });
      }
      return svgEl("rect", {
        class: baseClass,
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        rx: 0,
        ry: 0
      });
    }
    renderNodeText(node) {
      const textElement = svgEl("text", {
        class: `vd-flowchart-node-text vd-flowchart-node-text--${node.type}`,
        "data-node-id": node.id
      });
      if (node.type === "junction" || !node.text) {
        return textElement;
      }
      if (node.type === "textbox") {
        const lines2 = wrapText(node.text, estimateChars(node.width - 32));
        const { lineHeight: lineHeight2 } = getNodeFontMetrics(node);
        lines2.forEach((line, index) => {
          const span = svgEl("tspan", {
            x: 16,
            y: 28 + index * lineHeight2
          });
          span.textContent = line;
          textElement.appendChild(span);
        });
        return textElement;
      }
      const lines = wrapText(node.text, estimateChars(node.width));
      const { lineHeight } = getNodeFontMetrics(node);
      const totalHeight = (lines.length - 1) * lineHeight;
      const startY = node.height / 2 - totalHeight / 2;
      textElement.setAttribute("text-anchor", "middle");
      textElement.setAttribute("dominant-baseline", "middle");
      lines.forEach((line, index) => {
        const span = svgEl("tspan", {
          x: node.width / 2,
          y: startY + index * lineHeight,
          "text-anchor": "middle",
          "dominant-baseline": "middle"
        });
        span.textContent = line;
        textElement.appendChild(span);
      });
      return textElement;
    }
    renderSelectionPanel() {
      clearChildren(this.selectionFields);
      this.deleteButton.disabled = this.readonly || !this.selection;
      if (!this.selection) {
        this.selectionMeta.textContent = "Nothing selected";
        this.selectionFields.appendChild(createElement("p", {
          className: "vd-flowchart-selection-empty",
          text: "Select a node or edge to edit it."
        }));
        return;
      }
      if (this.selection.kind === "node") {
        const node = this.findNode(this.selection.id);
        if (!node) {
          this.selection = null;
          this.renderSelectionPanel();
          return;
        }
        this.selectionMeta.textContent = `Node ${node.id} \xB7 ${node.type} \xB7 ${Math.round(node.x)}, ${Math.round(node.y)}`;
        const typeSelect = createElement("select");
        typeSelect.setAttribute("data-field", "node-type");
        FLOWCHART_NODE_TYPES.forEach((type) => {
          const option = createElement("option", { value: type, text: type.replace("-", " ") });
          option.value = type;
          option.selected = type === node.type;
          typeSelect.appendChild(option);
        });
        const textArea = createElement("textarea", { value: node.text, rows: 5 });
        textArea.setAttribute("data-field", "node-text");
        const widthInput = createElement("input", { value: node.width, type: "number" });
        widthInput.setAttribute("data-field", "node-width");
        widthInput.setAttribute("min", String(MIN_NODE_SIZE));
        widthInput.setAttribute("max", String(MAX_NODE_SIZE));
        const heightInput = createElement("input", { value: node.height, type: "number" });
        heightInput.setAttribute("data-field", "node-height");
        heightInput.setAttribute("min", String(MIN_NODE_SIZE));
        heightInput.setAttribute("max", String(MAX_NODE_SIZE));
        this.selectionFields.appendChild(createField("Type", typeSelect));
        if (isNodeTextEditable(node)) {
          this.selectionFields.appendChild(createField("Text", textArea));
        }
        if (isNodeResizable(node)) {
          const sizeGrid = createElement("div", { className: "vd-flowchart-field-grid" });
          sizeGrid.appendChild(createField("Width", widthInput));
          sizeGrid.appendChild(createField("Height", heightInput));
          this.selectionFields.appendChild(sizeGrid);
        } else {
          this.selectionFields.appendChild(createElement("p", {
            className: "vd-flowchart-selection-empty",
            text: "Junctions stay fixed-size and do not carry inline text."
          }));
        }
        return;
      }
      const edge = this.findEdge(this.selection.id);
      if (!edge) {
        this.selection = null;
        this.renderSelectionPanel();
        return;
      }
      this.selectionMeta.textContent = `Edge ${edge.id} \xB7 ${edge.route} \xB7 ${formatNumber(edge.strokeWidth)}px \xB7 ${edge.startMarker} \u2192 ${edge.endMarker}`;
      const routeSelect = createElement("select");
      routeSelect.setAttribute("data-field", "edge-route");
      FLOWCHART_EDGE_ROUTES.forEach((route) => {
        const option = createElement("option", { value: route, text: FLOWCHART_EDGE_ROUTE_LABELS[route] });
        option.value = route;
        option.selected = route === edge.route;
        routeSelect.appendChild(option);
      });
      const startSelect = createElement("select");
      startSelect.setAttribute("data-field", "edge-start-marker");
      FLOWCHART_EDGE_MARKERS.forEach((marker) => {
        const option = createElement("option", { value: marker, text: marker });
        option.value = marker;
        option.selected = marker === edge.startMarker;
        startSelect.appendChild(option);
      });
      const endSelect = createElement("select");
      endSelect.setAttribute("data-field", "edge-end-marker");
      FLOWCHART_EDGE_MARKERS.forEach((marker) => {
        const option = createElement("option", { value: marker, text: marker });
        option.value = marker;
        option.selected = marker === edge.endMarker;
        endSelect.appendChild(option);
      });
      const widthSelect = createElement("select");
      widthSelect.setAttribute("data-field", "edge-stroke-preset");
      EDGE_STROKE_PRESETS.forEach((preset) => {
        const option = createElement("option", { value: preset.id, text: preset.label });
        option.value = preset.id;
        option.selected = preset.id === getStrokePresetId(edge.strokeWidth);
        widthSelect.appendChild(option);
      });
      const labelInput = createElement("textarea", { value: edge.label, rows: 4 });
      labelInput.setAttribute("data-field", "edge-label");
      const markerGrid = createElement("div", { className: "vd-flowchart-field-grid" });
      markerGrid.appendChild(createField("Route", routeSelect));
      markerGrid.appendChild(createField("Weight", widthSelect));
      markerGrid.appendChild(createField("Start", startSelect));
      markerGrid.appendChild(createField("End", endSelect));
      this.selectionFields.appendChild(markerGrid);
      this.selectionFields.appendChild(createField("Label", labelInput));
    }
    syncJsonTextarea(force = false) {
      if (!force && document.activeElement === this.jsonTextarea) {
        return;
      }
      this.jsonTextarea.value = JSON.stringify(this.toJSON(), null, 2);
    }
    getSelectionSnapshot() {
      if (!this.selection) return null;
      if (this.selection.kind === "node") {
        const node = this.findNode(this.selection.id);
        return node ? { kind: "node", id: node.id, node: deepClone(node) } : null;
      }
      const edge = this.findEdge(this.selection.id);
      return edge ? { kind: "edge", id: edge.id, edge: deepClone(edge) } : null;
    }
    select(selection) {
      const next = selection && selection.id && selection.kind ? { kind: selection.kind, id: selection.id } : null;
      const previousKey = this.selection ? `${this.selection.kind}:${this.selection.id}` : "";
      const nextKey = next ? `${next.kind}:${next.id}` : "";
      this.selection = next;
      if (previousKey !== nextKey) {
        this.render({ scene: true, inspector: true, json: false });
        this.emit("select", { selection: this.getSelectionSnapshot() });
        return;
      }
      this.render({ scene: true, inspector: false, json: false });
    }
    findNode(nodeId) {
      return this.documentData.nodes.find((node) => node.id === nodeId) || null;
    }
    findEdge(edgeId) {
      return this.documentData.edges.find((edge) => edge.id === edgeId) || null;
    }
    emit(eventName, payload) {
      const listeners = this.listeners[eventName];
      if (!listeners || !listeners.size) return;
      listeners.forEach((listener) => listener(payload));
    }
    emitChange(reason, extra = {}) {
      this.syncJsonTextarea();
      this.emit("change", {
        reason,
        document: this.toJSON(),
        ...extra
      });
    }
    emitViewportChange(reason) {
      const payload = {
        reason,
        viewport: deepClone(this.documentData.viewport),
        document: this.toJSON()
      };
      this.syncJsonTextarea();
      this.emit("viewport", payload);
      this.emit("change", payload);
    }
    on(eventName, callback) {
      if (!this.listeners[eventName]) {
        this.listeners[eventName] = /* @__PURE__ */ new Set();
      }
      this.listeners[eventName].add(callback);
      return this;
    }
    off(eventName, callback) {
      this.listeners[eventName]?.delete(callback);
      return this;
    }
    addNode(partialNode = {}) {
      const type = normalizeNodeType(partialNode.type);
      const spec = DEFAULT_NODE_SPECS[type];
      const center = this.getViewportCenter();
      const offset = this.paletteSerial % 6 * 26;
      this.paletteSerial += 1;
      const usedIds = new Set(this.documentData.nodes.map((node2) => node2.id));
      const node = normalizeNode({
        ...partialNode,
        type,
        x: partialNode.x == null ? formatNumber(center.x - spec.width / 2 + offset) : partialNode.x,
        y: partialNode.y == null ? formatNumber(center.y - spec.height / 2 + offset) : partialNode.y
      }, this.documentData.nodes.length, usedIds);
      this.documentData.nodes.push(node);
      this.select({ kind: "node", id: node.id });
      this.syncJsonTextarea();
      this.emitChange("node:add", { node: deepClone(node) });
      return deepClone(node);
    }
    applyNodePatch(node, patch = {}) {
      const nextType = normalizeNodeType(patch.type ?? node.type);
      node.type = nextType;
      node.x = patch.x == null ? node.x : formatNumber(toFiniteNumber(patch.x, node.x));
      node.y = patch.y == null ? node.y : formatNumber(toFiniteNumber(patch.y, node.y));
      node.text = isNodeTextEditable(nextType) ? patch.text == null ? node.text : String(patch.text) : getNodeSpec(nextType).text;
      node.width = clampNodeWidth(nextType, patch.width, node.width);
      node.height = clampNodeHeight(nextType, patch.height, node.height);
      if (isPlainObject(patch.data)) {
        node.data = deepClone(patch.data);
      }
    }
    updateNode(nodeId, patch = {}, options = {}) {
      const node = this.findNode(nodeId);
      if (!node) return null;
      const previousType = node.type;
      const previousSpec = DEFAULT_NODE_SPECS[previousType];
      this.applyNodePatch(node, patch);
      if (patch.type && previousType !== node.type) {
        const nextSpec = DEFAULT_NODE_SPECS[node.type];
        if (patch.width == null && node.width === previousSpec.width) {
          node.width = nextSpec.width;
        }
        if (patch.height == null && node.height === previousSpec.height) {
          node.height = nextSpec.height;
        }
        if (node.text === DEFAULT_NODE_SPECS[previousType].text) {
          node.text = nextSpec.text;
        }
      }
      this.render({
        scene: true,
        inspector: options.inspector !== false,
        json: true
      });
      this.emitChange(options.reason || "node:update", { node: deepClone(node) });
      return deepClone(node);
    }
    removeNode(nodeId) {
      const nodeIndex = this.documentData.nodes.findIndex((node) => node.id === nodeId);
      if (nodeIndex === -1) return false;
      if (this.textEditor?.nodeId === nodeId) {
        this.stopTextEdit({ commit: false });
      }
      this.documentData.nodes.splice(nodeIndex, 1);
      this.documentData.edges = this.documentData.edges.filter((edge) => edge.from.nodeId !== nodeId && edge.to.nodeId !== nodeId);
      if (this.selection?.kind === "node" && this.selection.id === nodeId) {
        this.selection = null;
      }
      this.render();
      this.emitChange("node:remove", { nodeId });
      return true;
    }
    updateEdge(edgeId, patch = {}, options = {}) {
      const edge = this.findEdge(edgeId);
      if (!edge) return null;
      const nodeIds = new Set(this.documentData.nodes.map((node) => node.id));
      const nextFrom = patch.from ? normalizeEndpoint(patch.from, edge.from.port) : edge.from;
      const nextTo = patch.to ? normalizeEndpoint(patch.to, edge.to.port) : edge.to;
      if (patch.from != null || patch.to != null) {
        if (!nodeIds.has(nextFrom.nodeId) || !nodeIds.has(nextTo.nodeId)) return null;
        if (!FLOWCHART_PORTS.includes(nextFrom.port) || !FLOWCHART_PORTS.includes(nextTo.port)) return null;
        if (nextFrom.nodeId === nextTo.nodeId && nextFrom.port === nextTo.port) return null;
        edge.from = nextFrom;
        edge.to = nextTo;
      }
      if (patch.kind != null) {
        edge.kind = patch.kind === "line" ? "line" : "arrow";
        if (patch.startMarker == null && patch.endMarker == null) {
          if (edge.kind === "line") {
            edge.startMarker = "none";
            edge.endMarker = "none";
          } else if (edge.endMarker === "none" && edge.startMarker === "none") {
            edge.endMarker = "arrow";
          }
        }
      }
      if (patch.startMarker != null) {
        edge.startMarker = normalizeEdgeMarker(patch.startMarker) || "none";
      }
      if (patch.endMarker != null) {
        edge.endMarker = normalizeEdgeMarker(patch.endMarker) || "none";
      }
      if (patch.route != null) {
        edge.route = normalizeEdgeRoute(patch.route);
      }
      if (patch.strokeWidth != null) {
        edge.strokeWidth = normalizeEdgeStrokeWidth(patch.strokeWidth);
      }
      if (patch.label != null) {
        edge.label = String(patch.label);
      }
      if (isPlainObject(patch.data)) {
        edge.data = deepClone(patch.data);
      }
      syncEdgeKind(edge);
      this.render({
        scene: true,
        inspector: options.inspector !== false,
        json: true
      });
      this.emitChange(options.reason || "edge:update", { edge: deepClone(edge) });
      return deepClone(edge);
    }
    addEdge(partialEdge = {}) {
      if (this.readonly) return null;
      const nodeIds = new Set(this.documentData.nodes.map((node) => node.id));
      const usedIds = new Set(this.documentData.edges.map((edge2) => edge2.id));
      const edge = normalizeEdge(partialEdge, this.documentData.edges.length, nodeIds, usedIds);
      if (!edge) return null;
      if (edge.from.nodeId === edge.to.nodeId && edge.from.port === edge.to.port) return null;
      this.documentData.edges.push(edge);
      this.select({ kind: "edge", id: edge.id });
      this.syncJsonTextarea();
      this.emit("connect", { edge: deepClone(edge) });
      this.emitChange("edge:add", { edge: deepClone(edge) });
      return deepClone(edge);
    }
    removeEdge(edgeId) {
      const edgeIndex = this.documentData.edges.findIndex((edge) => edge.id === edgeId);
      if (edgeIndex === -1) return false;
      this.documentData.edges.splice(edgeIndex, 1);
      if (this.selection?.kind === "edge" && this.selection.id === edgeId) {
        this.selection = null;
      }
      this.render();
      this.emitChange("edge:remove", { edgeId });
      return true;
    }
    deleteSelection() {
      if (!this.selection || this.readonly) return false;
      if (this.selection.kind === "node") return this.removeNode(this.selection.id);
      return this.removeEdge(this.selection.id);
    }
    setViewport(viewport) {
      this.documentData.viewport = normalizeViewport(viewport);
      this.render({ inspector: false, json: true });
      this.emitViewportChange("viewport:set");
      return this;
    }
    zoomIn() {
      const width = this.canvasEl.clientWidth || 800;
      const height = this.canvasEl.clientHeight || 560;
      this.scaleAround(1.12, width / 2, height / 2, "viewport:zoom");
      return this;
    }
    zoomOut() {
      const width = this.canvasEl.clientWidth || 800;
      const height = this.canvasEl.clientHeight || 560;
      this.scaleAround(1 / 1.12, width / 2, height / 2, "viewport:zoom");
      return this;
    }
    resetView() {
      this.documentData.viewport = normalizeViewport({ x: 0, y: 0, scale: 1 });
      this.render({ inspector: false, json: true });
      this.emitViewportChange("viewport:reset");
      return this;
    }
    fitView() {
      if (!this.documentData.nodes.length) {
        return this.resetView();
      }
      const bounds = getBounds(this.documentData.nodes);
      const width = this.canvasEl.clientWidth || 800;
      const height = this.canvasEl.clientHeight || 560;
      const padding = 80;
      const contentWidth = Math.max(1, bounds.right - bounds.left);
      const contentHeight = Math.max(1, bounds.bottom - bounds.top);
      const scale = clamp(
        Math.min((width - padding * 2) / contentWidth, (height - padding * 2) / contentHeight),
        MIN_SCALE,
        MAX_SCALE
      );
      this.documentData.viewport = {
        x: formatNumber(width / 2 - (bounds.left + bounds.right) / 2 * scale),
        y: formatNumber(height / 2 - (bounds.top + bounds.bottom) / 2 * scale),
        scale: formatNumber(scale)
      };
      this.render({ inspector: false, json: true });
      this.emitViewportChange("viewport:fit");
      return this;
    }
    clear() {
      this.stopTextEdit({ commit: false });
      this.activeTool = null;
      this.reconnectEdgeId = null;
      this.clipboard = null;
      this.documentData = normalizeDocument({ nodes: [], edges: [], viewport: { x: 0, y: 0, scale: 1 } });
      this.selection = null;
      this.render();
      this.emitChange("clear");
      return this;
    }
    load(data) {
      this.stopTextEdit({ commit: false });
      this.activeTool = null;
      this.reconnectEdgeId = null;
      this.documentData = normalizeDocument(data);
      this.selection = null;
      this.render();
      this.emitChange("load");
      return this;
    }
    toJSON() {
      return deepClone({
        version: VD_FLOWCHART_VERSION,
        viewport: this.documentData.viewport,
        nodes: this.documentData.nodes,
        edges: this.documentData.edges
      });
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.activeTool = null;
      this.stopTextEdit({ commit: false });
      this.unbindEvents();
      this.element.innerHTML = "";
      this.element.classList.remove("vd-flowchart-host");
    }
  };
  function optionsFromElement(element) {
    return {
      element,
      data: readAutoData(element),
      readonly: parseBooleanAttribute(element.getAttribute("data-vd-flowchart-readonly")),
      gridSize: parseNumberAttribute(element, "data-vd-flowchart-grid-size", DEFAULT_GRID_SIZE)
    };
  }
  var instances = /* @__PURE__ */ new Map();
  function init(root) {
    const targets = queryAll(root, "[data-vd-flowchart]");
    targets.forEach((element) => {
      if (instances.has(element)) return;
      const instance = new VdFlowchart(optionsFromElement(element));
      instances.set(element, instance);
    });
  }
  function destroy(element) {
    const instance = instances.get(element);
    if (!instance) return;
    instance.destroy();
    instances.delete(element);
  }
  function destroyAll(root) {
    const scope = normalizeRoot(root);
    Array.from(instances.keys()).forEach((element) => {
      if (!scope || scope === document || scope === element || typeof scope.contains === "function" && scope.contains(element)) {
        destroy(element);
      }
    });
  }
  function reinit(root) {
    destroyAll(root);
    init(root);
  }
  var VanduoFlowchart = {
    version: VD_FLOWCHART_VERSION,
    instances,
    init,
    destroy,
    destroyAll,
    reinit,
    VdFlowchart,
    FLOWCHART_NODE_TYPES,
    FLOWCHART_PORTS,
    FLOWCHART_EDGE_MARKERS
  };
  if (hasWindow()) {
    window.VanduoFlowchart = VanduoFlowchart;
    if (window.Vanduo && typeof window.Vanduo.register === "function") {
      window.Vanduo.register("flowchart", VanduoFlowchart);
    }
  }
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=vanduo-flowchart.iife.js.map
