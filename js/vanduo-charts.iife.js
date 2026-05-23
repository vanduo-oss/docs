var VanduoCharts = (() => {
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
    AreaChart: () => AreaChart,
    BarChart: () => BarChart,
    DonutChart: () => DonutChart,
    LineChart: () => LineChart,
    PieChart: () => PieChart,
    ScatterChart: () => ScatterChart,
    VD_CHARTS_VERSION: () => VD_CHARTS_VERSION,
    VanduoCharts: () => VanduoCharts,
    __testing: () => __testing,
    arcPath: () => arcPath,
    areaPath: () => areaPath,
    createAccessor: () => createAccessor,
    destroy: () => destroy,
    destroyAll: () => destroyAll,
    init: () => init,
    instances: () => instances,
    linePath: () => linePath,
    niceDomain: () => niceDomain,
    reinit: () => reinit,
    resolveTheme: () => resolveTheme,
    scaleBand: () => scaleBand,
    scaleLinear: () => scaleLinear,
    scaleOrdinal: () => scaleOrdinal,
    scalePoint: () => scalePoint,
    scaleTime: () => scaleTime,
    ticks: () => ticks
  });
  var SVG_NS = "http://www.w3.org/2000/svg";
  var TAU = Math.PI * 2;
  var ARC_EPSILON = 1e-4;
  var DEFAULT_WIDTH = 640;
  var DEFAULT_HEIGHT = 360;
  var DEFAULT_MARGIN = { top: 28, right: 24, bottom: 46, left: 56 };
  var POLAR_MARGIN = { top: 32, right: 24, bottom: 28, left: 24 };
  var DEFAULT_COLORS = [
    "#5c7cfa",
    "#228be6",
    "#40c057",
    "#fab005",
    "#fa5252",
    "#12b886",
    "#be4bdb",
    "#fd7e14"
  ];
  var VD_CHARTS_VERSION = "0.0.1";
  var chartId = 0;
  function nextId(prefix) {
    chartId += 1;
    return `${prefix}-${chartId}`;
  }
  function hasWindow() {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }
  function isElement(value) {
    return hasWindow() && value instanceof Element;
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
      scope.querySelectorAll(selector).forEach((el) => matches.push(el));
    }
    return matches;
  }
  function resolveTarget(target) {
    if (!hasWindow()) {
      throw new Error("Vanduo Charts requires a browser DOM target.");
    }
    if (typeof target === "string") {
      const el = document.querySelector(target);
      if (!el) throw new Error(`Chart target not found: ${target}`);
      return el;
    }
    if (isElement(target)) return target;
    throw new Error("Chart target must be an Element or selector string.");
  }
  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== null && typeof value !== "undefined") {
        el.setAttribute(key, String(value));
      }
    });
    return el;
  }
  function append(parent, child) {
    parent.appendChild(child);
    return child;
  }
  function setText(parent, text) {
    parent.textContent = text == null ? "" : String(text);
    return parent;
  }
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }
  function unique(values) {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    values.forEach((value) => {
      const key = String(value);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(value);
    });
    return result;
  }
  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function toNumber(value) {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
  function toTime(value) {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
  function isDateLike(value) {
    if (value instanceof Date) return Number.isFinite(value.getTime());
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed || /^-?\d+(\.\d+)?$/.test(trimmed)) return false;
    return Number.isFinite(Date.parse(trimmed));
  }
  function readPathValue(source, path) {
    if (source == null) return void 0;
    if (!String(path).includes(".")) return source[path];
    return String(path).split(".").reduce((value, key) => {
      if (value == null) return void 0;
      return value[key];
    }, source);
  }
  function createAccessor(accessor, fallback) {
    const resolved = accessor == null ? fallback : accessor;
    if (typeof resolved === "function") return resolved;
    if (typeof resolved === "string" && resolved.length) {
      return (datum) => readPathValue(datum, resolved);
    }
    return (datum) => datum;
  }
  function normalizeMargin(value, fallback = DEFAULT_MARGIN) {
    if (typeof value === "number") {
      return { top: value, right: value, bottom: value, left: value };
    }
    return {
      top: Number(value?.top ?? fallback.top),
      right: Number(value?.right ?? fallback.right),
      bottom: Number(value?.bottom ?? fallback.bottom),
      left: Number(value?.left ?? fallback.left)
    };
  }
  function measureTarget(target, options) {
    const width = Number(options.width) || Math.round(target.clientWidth) || DEFAULT_WIDTH;
    const height = Number(options.height) || Math.round(target.clientHeight) || DEFAULT_HEIGHT;
    return {
      width: Math.max(160, width),
      height: Math.max(140, height)
    };
  }
  function getPlotBox(width, height, margin) {
    return {
      left: margin.left,
      top: margin.top,
      right: Math.max(margin.left + 1, width - margin.right),
      bottom: Math.max(margin.top + 1, height - margin.bottom)
    };
  }
  function readToken(style, names, fallback) {
    for (const name of names) {
      const value = style.getPropertyValue(name).trim();
      if (value) return value;
    }
    return fallback;
  }
  function resolveTheme(target, overrides = {}) {
    if (!hasWindow()) {
      return {
        fontFamily: "inherit",
        textColor: "#1a1d20",
        mutedTextColor: "#868e96",
        gridColor: "#e9ecef",
        axisColor: "#ced4da",
        backgroundColor: "#ffffff",
        colors: DEFAULT_COLORS.slice(),
        ...overrides
      };
    }
    const styleTarget = isElement(target) ? target : document.documentElement;
    const style = getComputedStyle(styleTarget);
    const rootStyle = getComputedStyle(document.documentElement);
    const tokenStyle = {
      getPropertyValue(name) {
        return style.getPropertyValue(name) || rootStyle.getPropertyValue(name);
      }
    };
    const colors = DEFAULT_COLORS.map((fallback, index) => readToken(tokenStyle, [
      `--vd-chart-${index + 1}`,
      index === 0 ? "--vd-color-primary" : "",
      index === 1 ? "--vd-color-info" : "",
      index === 2 ? "--vd-color-success" : "",
      index === 3 ? "--vd-color-warning" : "",
      index === 4 ? "--vd-color-error" : "",
      index === 0 ? "--vd-color-primary" : "",
      index === 1 ? "--vd-color-info" : "",
      index === 2 ? "--vd-color-success" : ""
    ].filter(Boolean), fallback));
    return {
      fontFamily: readToken(tokenStyle, ["--vd-font-family-base"], "inherit"),
      textColor: readToken(tokenStyle, ["--vd-text-primary", "--vd-text-primary"], "#1a1d20"),
      mutedTextColor: readToken(tokenStyle, ["--vd-text-muted", "--vd-text-muted"], "#868e96"),
      gridColor: readToken(tokenStyle, ["--vd-border-color-light", "--vd-border-color-light", "--vd-border-color"], "#e9ecef"),
      axisColor: readToken(tokenStyle, ["--vd-border-color", "--vd-border-color"], "#ced4da"),
      backgroundColor: readToken(tokenStyle, ["--vd-bg-primary", "--vd-bg-primary"], "#ffffff"),
      ...overrides,
      colors: overrides.colors || colors
    };
  }
  function tickStep(min, max, count) {
    const span = Math.abs(max - min);
    if (!span || !Number.isFinite(span)) return 1;
    const raw = span / Math.max(1, count);
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const error = raw / power;
    const factor = error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1;
    return factor * power;
  }
  function ticks(min, max, count = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
    if (min === max) return [min];
    const reverse = max < min;
    const start = reverse ? max : min;
    const stop = reverse ? min : max;
    const step = tickStep(start, stop, count);
    const first = Math.ceil(start / step) * step;
    const values = [];
    for (let value = first; value <= stop + step / 2; value += step) {
      values.push(Number(value.toFixed(12)));
    }
    return reverse ? values.reverse() : values;
  }
  function niceDomain(values, includeZero = false) {
    const nums = values.map(toNumber).filter(isFiniteNumber);
    if (!nums.length) return [0, 1];
    let min = Math.min(...nums);
    let max = Math.max(...nums);
    if (includeZero) {
      min = Math.min(0, min);
      max = Math.max(0, max);
    }
    if (min === max) {
      const pad = Math.abs(min || 1) * 0.1;
      min -= pad;
      max += pad;
    }
    const step = tickStep(min, max, 5);
    return [
      Math.floor(min / step) * step,
      Math.ceil(max / step) * step
    ];
  }
  function scaleLinear(config = {}) {
    const domain = config.domain || [0, 1];
    const range = config.range || [0, 1];
    let d0 = Number(domain[0]);
    let d1 = Number(domain[1]);
    const r0 = Number(range[0]);
    const r1 = Number(range[1]);
    if (!Number.isFinite(d0)) d0 = 0;
    if (!Number.isFinite(d1)) d1 = 1;
    if (d0 === d1) {
      d0 -= 0.5;
      d1 += 0.5;
    }
    const scale = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return r0 + (n - d0) / (d1 - d0) * (r1 - r0);
    };
    scale.domain = () => [d0, d1];
    scale.range = () => [r0, r1];
    scale.ticks = (count = 5) => ticks(d0, d1, count);
    return scale;
  }
  function scaleTime(config = {}) {
    const domain = (config.domain || [/* @__PURE__ */ new Date(0), /* @__PURE__ */ new Date(1)]).map(toTime);
    const linear = scaleLinear({
      domain: [domain[0] ?? 0, domain[1] ?? 1],
      range: config.range || [0, 1]
    });
    const scale = (value) => linear(toTime(value));
    scale.domain = () => linear.domain().map((value) => new Date(value));
    scale.range = linear.range;
    scale.ticks = (count = 5) => linear.ticks(count).map((value) => new Date(value));
    return scale;
  }
  function scaleBand(config = {}) {
    const domain = unique(config.domain || []).map(String);
    const range = config.range || [0, 1];
    const paddingInner = Number(config.paddingInner ?? config.padding ?? 0.16);
    const paddingOuter = Number(config.paddingOuter ?? config.padding ?? 0.16);
    const r0 = Number(range[0]);
    const r1 = Number(range[1]);
    const span = r1 - r0;
    const denominator = Math.max(1, domain.length - paddingInner + paddingOuter * 2);
    const step = span / denominator;
    const bandwidth = Math.abs(step * Math.max(0, 1 - paddingInner));
    const scale = (value) => {
      const index = domain.indexOf(String(value));
      if (index < 0) return null;
      return r0 + (paddingOuter + index) * step;
    };
    scale.domain = () => domain.slice();
    scale.range = () => [r0, r1];
    scale.bandwidth = () => bandwidth;
    scale.step = () => Math.abs(step);
    return scale;
  }
  function scalePoint(config = {}) {
    const domain = unique(config.domain || []).map(String);
    const range = config.range || [0, 1];
    const padding = Number(config.padding ?? 0.5);
    const r0 = Number(range[0]);
    const r1 = Number(range[1]);
    const span = r1 - r0;
    const step = domain.length <= 1 ? 0 : span / Math.max(1, domain.length - 1 + padding * 2);
    const start = domain.length <= 1 ? r0 + span / 2 : r0 + padding * step;
    const scale = (value) => {
      const index = domain.indexOf(String(value));
      if (index < 0) return null;
      return start + index * step;
    };
    scale.domain = () => domain.slice();
    scale.range = () => [r0, r1];
    scale.step = () => Math.abs(step);
    scale.bandwidth = () => 0;
    return scale;
  }
  function scaleOrdinal(config = {}) {
    const domain = unique(config.domain || []).map(String);
    const range = config.range || DEFAULT_COLORS;
    const scale = (value) => {
      const key = String(value);
      let index = domain.indexOf(key);
      if (index < 0) {
        domain.push(key);
        index = domain.length - 1;
      }
      return range[index % range.length];
    };
    scale.domain = () => domain.slice();
    scale.range = () => range.slice();
    return scale;
  }
  function linePath(points) {
    const clean = points.filter((point) => isFiniteNumber(point.x) && isFiniteNumber(point.y));
    if (!clean.length) return "";
    return clean.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  }
  function areaPath(points, baselineY) {
    const clean = points.filter((point) => isFiniteNumber(point.x) && isFiniteNumber(point.y));
    if (!clean.length || !isFiniteNumber(baselineY)) return "";
    const line = linePath(clean);
    const last = clean[clean.length - 1];
    const first = clean[0];
    return `${line} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
  }
  function polarPoint(cx, cy, radius, angle) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
  }
  function arcPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
    if (!isFiniteNumber(outerRadius) || outerRadius <= 0 || endAngle <= startAngle) return "";
    const safeEnd = endAngle - startAngle >= TAU ? startAngle + TAU - ARC_EPSILON : endAngle;
    const largeArc = safeEnd - startAngle > Math.PI ? 1 : 0;
    const outerStart = polarPoint(cx, cy, outerRadius, startAngle);
    const outerEnd = polarPoint(cx, cy, outerRadius, safeEnd);
    const inner = Math.max(0, Number(innerRadius) || 0);
    if (inner <= 0) {
      return [
        `M${cx},${cy}`,
        `L${outerStart.x},${outerStart.y}`,
        `A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${outerEnd.x},${outerEnd.y}`,
        "Z"
      ].join(" ");
    }
    const innerEnd = polarPoint(cx, cy, inner, safeEnd);
    const innerStart = polarPoint(cx, cy, inner, startAngle);
    return [
      `M${outerStart.x},${outerStart.y}`,
      `A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${outerEnd.x},${outerEnd.y}`,
      `L${innerEnd.x},${innerEnd.y}`,
      `A${inner},${inner} 0 ${largeArc} 0 ${innerStart.x},${innerStart.y}`,
      "Z"
    ].join(" ");
  }
  function formatNumber(value) {
    if (!Number.isFinite(value)) return "";
    return Math.abs(value) >= 1e3 ? value.toLocaleString() : String(Number(value.toFixed(3)));
  }
  function formatTick(value, formatter) {
    if (typeof formatter === "function") return formatter(value);
    if (value instanceof Date) {
      return new Intl.DateTimeFormat(void 0, { month: "short", day: "numeric" }).format(value);
    }
    return formatNumber(Number(value));
  }
  function formatCategory(value) {
    return value == null ? "" : String(value);
  }
  function attachTooltip(instance, mark, options, datum, fallback) {
    const tooltip = options.tooltip;
    if (tooltip === false) return;
    const getContent = () => {
      if (typeof tooltip === "function") return tooltip(datum);
      if (typeof tooltip === "string") return tooltip;
      return fallback;
    };
    const show = (event) => {
      const content = getContent();
      if (content == null || content === "") return;
      instance.showTooltip(content, event);
    };
    const hide = () => instance.hideTooltip();
    mark.addEventListener("pointerenter", show);
    mark.addEventListener("pointermove", show);
    mark.addEventListener("pointerleave", hide);
    mark.addEventListener("focus", show);
    mark.addEventListener("blur", hide);
  }
  function attachClick(mark, callback, datum, index) {
    if (typeof callback !== "function") return;
    const fire = (event) => callback({ event, datum, index });
    mark.addEventListener("click", fire);
    mark.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fire(event);
      }
    });
  }
  function makeInteractive(mark, hasClick, hasTooltip) {
    if (hasClick || hasTooltip) {
      mark.setAttribute("tabindex", "0");
      mark.setAttribute("focusable", "true");
    }
  }
  function createSvgShell(instance) {
    const { target, options } = instance;
    const size = measureTarget(target, options);
    const theme = resolveTheme(target, options.theme);
    const margin = normalizeMargin(options.margin, options.polar ? POLAR_MARGIN : DEFAULT_MARGIN);
    const plot = getPlotBox(size.width, size.height, margin);
    target.innerHTML = "";
    target.classList.add("vd-chart-root", `vd-chart-${instance.kind}`);
    if (getComputedStyle(target).position === "static") {
      target.style.position = "relative";
    }
    const svg = svgEl("svg", {
      class: "vd-chart-svg",
      width: size.width,
      height: size.height,
      viewBox: `0 0 ${size.width} ${size.height}`,
      role: "img"
    });
    const titleId = nextId("vd-chart-title");
    const descId = nextId("vd-chart-desc");
    const labelledBy = [];
    if (options.title) {
      labelledBy.push(titleId);
      append(svg, setText(svgEl("title", { id: titleId }), options.title));
    }
    if (options.description) {
      labelledBy.push(descId);
      append(svg, setText(svgEl("desc", { id: descId }), options.description));
    }
    if (labelledBy.length) {
      svg.setAttribute("aria-labelledby", labelledBy.join(" "));
    } else {
      svg.setAttribute("aria-label", options.ariaLabel || `${instance.kind} chart`);
    }
    if (options.title) {
      append(svg, setText(svgEl("text", {
        x: margin.left,
        y: 18,
        fill: theme.textColor,
        "font-size": 14,
        "font-weight": 600
      }), options.title));
    }
    target.appendChild(svg);
    instance.theme = theme;
    instance.size = size;
    instance.plot = plot;
    instance.tooltipEl = null;
    return { svg, size, theme, plot, margin };
  }
  function renderEmpty(svg, size, theme, message = "No data") {
    append(svg, setText(svgEl("text", {
      class: "vd-chart-empty",
      x: size.width / 2,
      y: size.height / 2,
      fill: theme.mutedTextColor,
      "text-anchor": "middle"
    }), message));
  }
  function drawAxisLine(svg, x1, y1, x2, y2, theme) {
    append(svg, svgEl("line", {
      x1,
      y1,
      x2,
      y2,
      stroke: theme.axisColor,
      "stroke-width": 1,
      "shape-rendering": "crispEdges"
    }));
  }
  function drawCartesianAxes(svg, config) {
    const { plot, xScale, yScale, xTicks, yTicks, theme, options, categoricalX } = config;
    const axisGroup = append(svg, svgEl("g", { class: "vd-chart-axes" }));
    yTicks.forEach((tick) => {
      const y = yScale(tick);
      if (!isFiniteNumber(y)) return;
      append(axisGroup, svgEl("line", {
        x1: plot.left,
        y1: y,
        x2: plot.right,
        y2: y,
        stroke: theme.gridColor,
        "stroke-width": 1,
        "shape-rendering": "crispEdges"
      }));
      append(axisGroup, setText(svgEl("text", {
        x: plot.left - 10,
        y: y + 4,
        fill: theme.mutedTextColor,
        "font-size": 11,
        "text-anchor": "end"
      }), formatTick(tick, options.yFormat)));
    });
    drawAxisLine(axisGroup, plot.left, plot.bottom, plot.right, plot.bottom, theme);
    drawAxisLine(axisGroup, plot.left, plot.top, plot.left, plot.bottom, theme);
    xTicks.forEach((tick) => {
      let x = xScale(tick);
      if (categoricalX && typeof xScale.bandwidth === "function") {
        x += xScale.bandwidth() / 2;
      }
      if (!isFiniteNumber(x)) return;
      append(axisGroup, svgEl("line", {
        x1: x,
        y1: plot.bottom,
        x2: x,
        y2: plot.bottom + 5,
        stroke: theme.axisColor,
        "stroke-width": 1
      }));
      append(axisGroup, setText(svgEl("text", {
        x,
        y: plot.bottom + 20,
        fill: theme.mutedTextColor,
        "font-size": 11,
        "text-anchor": "middle"
      }), categoricalX ? formatCategory(tick) : formatTick(tick, options.xFormat)));
    });
    if (options.xAxis?.label) {
      append(axisGroup, setText(svgEl("text", {
        x: (plot.left + plot.right) / 2,
        y: plot.bottom + 40,
        fill: theme.mutedTextColor,
        "font-size": 12,
        "text-anchor": "middle"
      }), options.xAxis.label));
    }
    if (options.yAxis?.label) {
      append(axisGroup, setText(svgEl("text", {
        x: -((plot.top + plot.bottom) / 2),
        y: 15,
        fill: theme.mutedTextColor,
        "font-size": 12,
        "text-anchor": "middle",
        transform: "rotate(-90)"
      }), options.yAxis.label));
    }
  }
  function inferXScale(rows, plot, options) {
    const values = rows.map((row) => row.x);
    const explicitType = options.xScale;
    const allNumeric = values.every((value) => toNumber(value) !== null);
    const allDates = values.every(isDateLike);
    if (explicitType === "time" || !explicitType && allDates) {
      const times = values.map(toTime).filter(isFiniteNumber);
      return {
        scale: scaleTime({ domain: niceDomain(times), range: [plot.left, plot.right] }),
        values: times,
        ticks: scaleLinear({ domain: niceDomain(times), range: [plot.left, plot.right] }).ticks(5).map((value) => new Date(value)),
        type: "time",
        mapValue: toTime
      };
    }
    if (explicitType === "linear" || !explicitType && allNumeric) {
      const nums = values.map(toNumber).filter(isFiniteNumber);
      const domain2 = niceDomain(nums, false);
      const scale = scaleLinear({ domain: domain2, range: [plot.left, plot.right] });
      return {
        scale,
        values: nums,
        ticks: scale.ticks(5),
        type: "linear",
        mapValue: toNumber
      };
    }
    const domain = unique(values).map(String);
    return {
      scale: scalePoint({ domain, range: [plot.left, plot.right], padding: 0.5 }),
      values: domain,
      ticks: domain,
      type: "point",
      mapValue: (value) => String(value)
    };
  }
  function getColorScale(rows, accessor, theme) {
    if (!accessor) return null;
    const colorAccessor = createAccessor(accessor);
    const domain = unique(rows.map((row) => colorAccessor(row.raw))).map(String);
    return {
      accessor: colorAccessor,
      scale: scaleOrdinal({ domain, range: theme.colors })
    };
  }
  function renderBarChart(instance) {
    const shell = createSvgShell(instance);
    const { svg, size, theme, plot } = shell;
    const options = instance.options;
    const data = toArray(options.data);
    const xAccessor = createAccessor(options.x, "x");
    const yAccessor = createAccessor(options.y, "y");
    const rows = data.map((datum, index) => ({
      raw: datum,
      index,
      x: xAccessor(datum),
      y: toNumber(yAccessor(datum))
    })).filter((row) => row.x != null && isFiniteNumber(row.y));
    if (!rows.length) {
      renderEmpty(svg, size, theme);
      return;
    }
    const categories = unique(rows.map((row) => row.x)).map(String);
    const xScale = scaleBand({
      domain: categories,
      range: [plot.left, plot.right],
      padding: options.barPadding ?? 0.18
    });
    const yDomain = niceDomain(rows.map((row) => row.y), true);
    const yScale = scaleLinear({ domain: yDomain, range: [plot.bottom, plot.top] });
    const yTicks = yScale.ticks(5);
    const color = getColorScale(rows, options.color, theme);
    drawCartesianAxes(svg, {
      plot,
      xScale,
      yScale,
      xTicks: categories,
      yTicks,
      theme,
      options,
      categoricalX: true
    });
    const markGroup = append(svg, svgEl("g", { class: "vd-chart-marks vd-chart-bars" }));
    const baseline = yScale(0);
    rows.forEach((row) => {
      const x = xScale(row.x);
      const y = yScale(row.y);
      if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(baseline)) return;
      const rectY = Math.min(y, baseline);
      const rectHeight = Math.max(1, Math.abs(baseline - y));
      const fill = color ? color.scale(color.accessor(row.raw)) : theme.colors[row.index % theme.colors.length];
      const rect = svgEl("rect", {
        class: "vd-chart-bar",
        x,
        y: rectY,
        width: xScale.bandwidth(),
        height: rectHeight,
        rx: 3,
        fill,
        role: "graphics-symbol",
        "aria-label": `${formatCategory(row.x)}: ${formatNumber(row.y)}`
      });
      makeInteractive(rect, typeof options.onBarClick === "function", options.tooltip !== false);
      attachTooltip(instance, rect, options, row.raw, `${formatCategory(row.x)}: ${formatNumber(row.y)}`);
      attachClick(rect, options.onBarClick, row.raw, row.index);
      append(markGroup, rect);
    });
  }
  function renderLineLikeChart(instance, mode) {
    const shell = createSvgShell(instance);
    const { svg, size, theme, plot } = shell;
    const options = instance.options;
    const data = toArray(options.data);
    const xAccessor = createAccessor(options.x, "x");
    const yAccessor = createAccessor(options.y, "y");
    const rows = data.map((datum, index) => ({
      raw: datum,
      index,
      x: xAccessor(datum),
      y: toNumber(yAccessor(datum))
    })).filter((row) => row.x != null && isFiniteNumber(row.y));
    if (!rows.length) {
      renderEmpty(svg, size, theme);
      return;
    }
    const xInfo = inferXScale(rows, plot, options);
    const yDomain = niceDomain(rows.map((row) => row.y), mode === "area" || options.yIncludeZero === true);
    const yScale = scaleLinear({ domain: yDomain, range: [plot.bottom, plot.top] });
    const yTicks = yScale.ticks(5);
    const color = options.stroke || theme.colors[0];
    const points = rows.map((row) => ({
      raw: row.raw,
      index: row.index,
      xValue: row.x,
      yValue: row.y,
      x: xInfo.scale(xInfo.mapValue(row.x)),
      y: yScale(row.y)
    })).filter((point) => isFiniteNumber(point.x) && isFiniteNumber(point.y));
    drawCartesianAxes(svg, {
      plot,
      xScale: xInfo.scale,
      yScale,
      xTicks: xInfo.ticks,
      yTicks,
      theme,
      options,
      categoricalX: xInfo.type === "point"
    });
    const markGroup = append(svg, svgEl("g", { class: `vd-chart-marks vd-chart-${mode}` }));
    if (mode === "area") {
      const baseline = yScale(Math.max(0, yDomain[0]));
      append(markGroup, svgEl("path", {
        class: "vd-chart-area-path",
        d: areaPath(points, baseline),
        fill: options.fill || color,
        opacity: options.fillOpacity ?? 0.18,
        stroke: "none"
      }));
    }
    append(markGroup, svgEl("path", {
      class: "vd-chart-line-path",
      d: linePath(points),
      fill: "none",
      stroke: color,
      "stroke-width": options.strokeWidth || 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }));
    if (options.points !== false) {
      points.forEach((point) => {
        const circle = svgEl("circle", {
          class: "vd-chart-point",
          cx: point.x,
          cy: point.y,
          r: options.pointRadius || 3.5,
          fill: options.pointFill || theme.backgroundColor,
          stroke: color,
          "stroke-width": 2,
          role: "graphics-symbol",
          "aria-label": `${formatCategory(point.xValue)}: ${formatNumber(point.yValue)}`
        });
        makeInteractive(circle, typeof options.onPointClick === "function", options.tooltip !== false);
        attachTooltip(instance, circle, options, point.raw, `${formatCategory(point.xValue)}: ${formatNumber(point.yValue)}`);
        attachClick(circle, options.onPointClick, point.raw, point.index);
        append(markGroup, circle);
      });
    }
  }
  function renderScatterChart(instance) {
    const shell = createSvgShell(instance);
    const { svg, size, theme, plot } = shell;
    const options = instance.options;
    const data = toArray(options.data);
    const xAccessor = createAccessor(options.x, "x");
    const yAccessor = createAccessor(options.y, "y");
    const rows = data.map((datum, index) => ({
      raw: datum,
      index,
      x: xAccessor(datum),
      y: toNumber(yAccessor(datum))
    })).filter((row) => row.x != null && isFiniteNumber(row.y));
    if (!rows.length) {
      renderEmpty(svg, size, theme);
      return;
    }
    const xInfo = inferXScale(rows, plot, options);
    const yDomain = niceDomain(rows.map((row) => row.y), options.yIncludeZero === true);
    const yScale = scaleLinear({ domain: yDomain, range: [plot.bottom, plot.top] });
    const yTicks = yScale.ticks(5);
    const color = getColorScale(rows, options.color, theme);
    drawCartesianAxes(svg, {
      plot,
      xScale: xInfo.scale,
      yScale,
      xTicks: xInfo.ticks,
      yTicks,
      theme,
      options,
      categoricalX: xInfo.type === "point"
    });
    const markGroup = append(svg, svgEl("g", { class: "vd-chart-marks vd-chart-scatter" }));
    rows.forEach((row) => {
      const cx = xInfo.scale(xInfo.mapValue(row.x));
      const cy = yScale(row.y);
      if (!isFiniteNumber(cx) || !isFiniteNumber(cy)) return;
      const fill = color ? color.scale(color.accessor(row.raw)) : theme.colors[row.index % theme.colors.length];
      const circle = svgEl("circle", {
        class: "vd-chart-scatter-point",
        cx,
        cy,
        r: options.pointRadius || 4,
        fill,
        opacity: options.pointOpacity ?? 0.88,
        role: "graphics-symbol",
        "aria-label": `${formatCategory(row.x)}: ${formatNumber(row.y)}`
      });
      makeInteractive(circle, typeof options.onPointClick === "function", options.tooltip !== false);
      attachTooltip(instance, circle, options, row.raw, `${formatCategory(row.x)}: ${formatNumber(row.y)}`);
      attachClick(circle, options.onPointClick, row.raw, row.index);
      append(markGroup, circle);
    });
  }
  function renderLegend(svg, rows, colorScale, theme, x, y) {
    const legend = append(svg, svgEl("g", { class: "vd-chart-legend" }));
    rows.slice(0, 8).forEach((row, index) => {
      const itemY = y + index * 20;
      append(legend, svgEl("rect", {
        x,
        y: itemY - 9,
        width: 10,
        height: 10,
        rx: 2,
        fill: colorScale(row.label)
      }));
      append(legend, setText(svgEl("text", {
        x: x + 16,
        y: itemY,
        fill: theme.mutedTextColor,
        "font-size": 11
      }), formatCategory(row.label)));
    });
  }
  function renderDonutChart(instance) {
    instance.options.polar = true;
    const shell = createSvgShell(instance);
    const { svg, size, theme, plot } = shell;
    const options = instance.options;
    const data = toArray(options.data);
    const labelAccessor = createAccessor(options.label, "label");
    const valueAccessor = createAccessor(options.value, "value");
    const rows = data.map((datum, index) => ({
      raw: datum,
      index,
      label: labelAccessor(datum),
      value: toNumber(valueAccessor(datum))
    })).filter((row) => row.label != null && isFiniteNumber(row.value) && row.value > 0);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    if (!rows.length || total <= 0) {
      renderEmpty(svg, size, theme);
      return;
    }
    const legendSpace = options.legend === false || size.width < 520 ? 0 : 128;
    const cx = (plot.left + plot.right - legendSpace) / 2;
    const cy = (plot.top + plot.bottom) / 2 + 5;
    const outerRadius = Math.max(28, Math.min(plot.right - plot.left - legendSpace, plot.bottom - plot.top) / 2);
    const ratio = Math.max(0, Math.min(0.9, Number(options.innerRadiusRatio ?? 0.62)));
    const innerRadius = outerRadius * ratio;
    const colorScale = scaleOrdinal({ domain: rows.map((row) => row.label), range: theme.colors });
    const markGroup = append(svg, svgEl("g", { class: "vd-chart-marks vd-chart-slices" }));
    let cursor = -Math.PI / 2;
    rows.forEach((row) => {
      const angle = row.value / total * TAU;
      const start = cursor;
      const end = cursor + angle;
      cursor = end;
      const path = svgEl("path", {
        class: "vd-chart-slice",
        d: arcPath(cx, cy, outerRadius, innerRadius, start, end),
        fill: colorScale(row.label),
        stroke: theme.backgroundColor,
        "stroke-width": 2,
        role: "graphics-symbol",
        "aria-label": `${formatCategory(row.label)}: ${formatNumber(row.value)}`
      });
      makeInteractive(path, typeof options.onSliceClick === "function", options.tooltip !== false);
      attachTooltip(instance, path, options, row.raw, `${formatCategory(row.label)}: ${formatNumber(row.value)}`);
      attachClick(path, options.onSliceClick, row.raw, row.index);
      append(markGroup, path);
    });
    if (innerRadius > 16 && options.centerLabel !== false) {
      append(svg, setText(svgEl("text", {
        x: cx,
        y: cy - 2,
        fill: theme.textColor,
        "font-size": 18,
        "font-weight": 700,
        "text-anchor": "middle"
      }), options.centerLabel || formatNumber(total)));
      append(svg, setText(svgEl("text", {
        x: cx,
        y: cy + 16,
        fill: theme.mutedTextColor,
        "font-size": 11,
        "text-anchor": "middle"
      }), options.centerSubLabel || "total"));
    }
    if (legendSpace) {
      renderLegend(svg, rows, colorScale, theme, plot.right - legendSpace + 8, plot.top + 28);
    }
  }
  var ChartInstance = class {
    constructor(kind, options, renderer) {
      this.kind = kind;
      this.options = { ...options };
      this.target = resolveTarget(options.target);
      this.renderer = renderer;
      this.resizeObserver = null;
      this.destroyed = false;
      this.theme = null;
      this.size = null;
      this.plot = null;
      this.tooltipEl = null;
      this.render();
      this.setupResizeObserver();
    }
    render() {
      if (this.destroyed) return this;
      this.renderer(this);
      return this;
    }
    update(nextOptions = {}) {
      if (this.destroyed) return this;
      this.options = { ...this.options, ...nextOptions };
      return this.render();
    }
    resize() {
      return this.render();
    }
    setupResizeObserver() {
      if (this.options.responsive === false || !hasWindow() || typeof ResizeObserver === "undefined") return;
      let lastWidth = this.target.clientWidth;
      let lastHeight = this.target.clientHeight;
      this.resizeObserver = new ResizeObserver(() => {
        const width = this.target.clientWidth;
        const height = this.target.clientHeight;
        if (width === lastWidth && height === lastHeight) return;
        lastWidth = width;
        lastHeight = height;
        this.resize();
      });
      this.resizeObserver.observe(this.target);
    }
    ensureTooltip() {
      if (this.tooltipEl && this.tooltipEl.isConnected) return this.tooltipEl;
      const tooltip = document.createElement("div");
      tooltip.className = "vd-chart-tooltip";
      tooltip.setAttribute("role", "status");
      tooltip.setAttribute("aria-live", "polite");
      this.target.appendChild(tooltip);
      this.tooltipEl = tooltip;
      return tooltip;
    }
    showTooltip(content, event) {
      const tooltip = this.ensureTooltip();
      tooltip.textContent = String(content);
      const rect = this.target.getBoundingClientRect();
      let x = rect.width / 2;
      let y = rect.height / 2;
      if (event && isFiniteNumber(event.clientX) && isFiniteNumber(event.clientY)) {
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
      } else if (event && event.target && typeof event.target.getBoundingClientRect === "function") {
        const markRect = event.target.getBoundingClientRect();
        x = markRect.left + markRect.width / 2 - rect.left;
        y = markRect.top - rect.top;
      }
      tooltip.style.left = `${Math.max(8, Math.min(rect.width - 8, x))}px`;
      tooltip.style.top = `${Math.max(18, Math.min(rect.height - 8, y))}px`;
      tooltip.classList.add("is-visible");
    }
    hideTooltip() {
      if (this.tooltipEl) {
        this.tooltipEl.classList.remove("is-visible");
      }
    }
    destroy() {
      if (this.destroyed) return;
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      this.target.innerHTML = "";
      this.target.classList.remove("vd-chart-root", `vd-chart-${this.kind}`);
      this.destroyed = true;
    }
  };
  function createChartFactory(kind, renderer, defaults = {}) {
    return function chartFactory(options = {}) {
      return new ChartInstance(kind, { ...defaults, ...options }, renderer);
    };
  }
  var BarChart = createChartFactory("bar", renderBarChart);
  var LineChart = createChartFactory("line", (instance) => renderLineLikeChart(instance, "line"));
  var AreaChart = createChartFactory("area", (instance) => renderLineLikeChart(instance, "area"));
  var ScatterChart = createChartFactory("scatter", renderScatterChart);
  var DonutChart = createChartFactory("donut", renderDonutChart, { innerRadiusRatio: 0.62 });
  var PieChart = createChartFactory("pie", renderDonutChart, { innerRadiusRatio: 0 });
  var chartFactories = {
    bar: BarChart,
    line: LineChart,
    area: AreaChart,
    scatter: ScatterChart,
    pie: PieChart,
    donut: DonutChart
  };
  function parseJsonData(text, context) {
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`[Vanduo Charts] Failed to parse chart data${context ? ` from ${context}` : ""}:`, error);
      return [];
    }
  }
  function readAutoData(el) {
    const source = el.getAttribute("data-vd-chart-data");
    if (!source) return parseJsonData(el.textContent.trim(), "element text");
    if (source.trim().startsWith("#")) {
      const script = document.querySelector(source.trim());
      return script ? parseJsonData(script.textContent, source.trim()) : [];
    }
    if (source.trim().startsWith("[")) {
      return parseJsonData(source, "data-vd-chart-data");
    }
    return [];
  }
  function parseNumberAttr(el, name) {
    const value = el.getAttribute(name);
    if (value == null || value === "") return void 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  function optionsFromElement(el) {
    const type = (el.getAttribute("data-vd-chart") || "").trim().toLowerCase();
    return {
      type,
      target: el,
      data: readAutoData(el),
      x: el.getAttribute("data-vd-x") || void 0,
      y: el.getAttribute("data-vd-y") || void 0,
      label: el.getAttribute("data-vd-label") || void 0,
      value: el.getAttribute("data-vd-value") || void 0,
      color: el.getAttribute("data-vd-color") || void 0,
      title: el.getAttribute("data-vd-title") || void 0,
      description: el.getAttribute("data-vd-description") || void 0,
      width: parseNumberAttr(el, "data-vd-width"),
      height: parseNumberAttr(el, "data-vd-height"),
      innerRadiusRatio: parseNumberAttr(el, "data-vd-inner-radius-ratio")
    };
  }
  var instances = /* @__PURE__ */ new Map();
  function init(root) {
    const charts = queryAll(root, "[data-vd-chart]");
    charts.forEach((el) => {
      if (instances.has(el)) return;
      const options = optionsFromElement(el);
      const factory = chartFactories[options.type];
      if (!factory) {
        console.warn(`[Vanduo Charts] Unknown chart type: ${options.type}`);
        return;
      }
      const instance = factory(options);
      instances.set(el, instance);
    });
  }
  function destroy(el) {
    const instance = instances.get(el);
    if (!instance) return;
    instance.destroy();
    instances.delete(el);
  }
  function destroyAll(root) {
    const scope = normalizeRoot(root);
    Array.from(instances.keys()).forEach((el) => {
      if (!scope || scope === document || scope === el || typeof scope.contains === "function" && scope.contains(el)) {
        destroy(el);
      }
    });
  }
  function reinit(root) {
    destroyAll(root);
    init(root);
  }
  var VanduoCharts = {
    version: VD_CHARTS_VERSION,
    instances,
    init,
    destroy,
    destroyAll,
    reinit,
    BarChart,
    LineChart,
    AreaChart,
    ScatterChart,
    PieChart,
    DonutChart,
    createAccessor,
    scaleLinear,
    scaleBand,
    scalePoint,
    scaleTime,
    scaleOrdinal,
    resolveTheme
  };
  var __testing = {
    linePath,
    areaPath,
    arcPath,
    niceDomain,
    ticks
  };
  if (hasWindow()) {
    window.VanduoCharts = VanduoCharts;
    if (window.Vanduo && typeof window.Vanduo.register === "function") {
      window.Vanduo.register("charts", VanduoCharts);
    }
  }
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=vanduo-charts.iife.js.map
