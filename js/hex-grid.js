// VdHexGrid - Dynamic controllable Hex Grid API for Vanduo framework
// Based on web-civ HexGrid implementation
// Enables developers to use hex grids as components and game devs creating web civ-like games

import { hexToPixel, pixelToHex, getHexCorners, getAdjacentHexes } from './utils/hex-math.js';

// Constants
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;
const ZOOM_FACTOR = 0.1;
const DRAG_THRESHOLD = 2;

/**
 * VdHexGrid - A dynamic controllable hex grid component
 * 
 * @example
 * const grid = new VdHexGrid({
 *     element: document.getElementById('container'),
 *     canvas: document.getElementById('canvas'),
 *     size: 30,
 *     width: 15,
 *     height: 10
 * });
 * 
 * grid.on('select', (hex) => {
 *     console.log('Selected:', hex.q, hex.r);
 * });
 */
export class VdHexGrid {
    constructor({ element, canvas, size = 30, width = 10, height = 10 }) {
        this.element = element;
        this.canvas = canvas;
        this.size = size;
        this.width = width;
        this.height = height;
        this.hexes = new Map();
        this.selectedHex = null;
        this.listeners = {};
        
        // Transform state for pan/zoom
        this.transform = { x: 0, y: 0, scale: 1 };
        
        // Drag state
        this.dragging = false;
        this.lastPos = null;
        this.hasMoved = false;
        
        // Theme colors
        this.themeColors = this._getThemeColors();
        
        // Set up canvas if not already done
        if (!this.canvas) {
            this.canvas = element.querySelector('canvas') || document.createElement('canvas');
            if (!element.contains(this.canvas)) {
                element.appendChild(this.canvas);
            }
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // Generate the grid
        this._generateGrid();
        this._render();
        this._setupEvents();
        
        // Observe theme changes
        this._observeThemeChanges();
    }
    
    /**
     * Get theme colors from CSS custom properties
     */
    _getThemeColors() {
        const root = document.documentElement;
        const style = getComputedStyle(root);
        
        return {
            bgPrimary: style.getPropertyValue('--bg-primary').trim() || '#ffffff',
            bgSecondary: style.getPropertyValue('--bg-secondary').trim() || '#f5f5f5',
            borderColor: style.getPropertyValue('--border-color').trim() || '#e0e0e0',
            colorPrimary: style.getPropertyValue('--color-primary').trim() || '#3b82f6',
            textColor: style.getPropertyValue('--text-primary').trim() || '#1f2937',
            textMuted: style.getPropertyValue('--text-muted').trim() || '#6b7280'
        };
    }
    
    /**
     * Observe theme changes and re-render when theme changes
     */
    _observeThemeChanges() {
        const observer = new MutationObserver(() => {
            this.themeColors = this._getThemeColors();
            this._render();
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }
    
    /**
     * Convert screen coordinates to world coordinates
     */
    _screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.transform.x) / this.transform.scale,
            y: (screenY - this.transform.y) / this.transform.scale
        };
    }
    
    /**
     * Generate hex grid data
     */
    _generateGrid() {
        this.hexes.clear();
        
        // Calculate offset to center the grid
        const gridWidth = this.width * this.size * 1.5;
        const gridHeight = this.height * this.size * Math.sqrt(3);
        
        for (let r = 0; r < this.height; r++) {
            const qOffset = Math.floor(r / 2);
            for (let q = -qOffset; q < this.width - qOffset; q++) {
                const pixel = hexToPixel(q, r, this.size);
                const hex = {
                    q,
                    r,
                    x: pixel.x,
                    y: pixel.y,
                    fill: this.themeColors.bgSecondary,
                    stroke: this.themeColors.borderColor,
                    adjacent: getAdjacentHexes(q, r)
                };
                this.hexes.set(`${q},${r}`, hex);
            }
        }
    }
    
    /**
     * Render the hex grid on canvas
     */
    _render() {
        // Get canvas displayed size
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width || 800;
        const displayHeight = rect.height || 400;
        
        // Set canvas internal resolution to match display
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        
        // Clear canvas with theme background
        this.ctx.fillStyle = this.themeColors.bgPrimary;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply transform
        this.ctx.save();
        this.ctx.translate(this.transform.x, this.transform.y);
        this.ctx.scale(this.transform.scale, this.transform.scale);
        
        // Draw all hexes
        this.hexes.forEach(hex => {
            this._drawHex(hex);
        });
        
        // Redraw selected hex if any
        if (this.selectedHex) {
            this._drawHex(this.selectedHex, true);
        }
        
        this.ctx.restore();
    }
    
    /**
     * Draw a single hex
     */
    _drawHex(hex, isSelected = false) {
        const corners = getHexCorners(hex.x, hex.y, this.size);
        
        this.ctx.beginPath();
        this.ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
            this.ctx.lineTo(corners[i].x, corners[i].y);
        }
        this.ctx.closePath();
        
        // Fill with theme color or custom fill
        const fill = isSelected ? this.themeColors.colorPrimary : (hex.fill || this.themeColors.bgSecondary);
        this.ctx.fillStyle = fill;
        this.ctx.fill();
        
        // Stroke with theme color
        const stroke = isSelected ? this.themeColors.colorPrimary : (hex.stroke || this.themeColors.borderColor);
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = isSelected ? 3 : 1;
        this.ctx.stroke();
        
        // Draw coordinates for selected hex
        if (isSelected) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${hex.q},${hex.r}`, hex.x, hex.y);
        }
    }
    
    /**
     * Set up mouse/touch events for hex selection, pan, and zoom
     */
    _setupEvents() {
        // Pan - pointer down
        this.canvas.addEventListener('pointerdown', (e) => {
            this.dragging = true;
            this.hasMoved = false;
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        });
        
        // Pan - pointer move
        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.dragging) return;
            
            const cur = { x: e.clientX, y: e.clientY };
            const dx = cur.x - this.lastPos.x;
            const dy = cur.y - this.lastPos.y;
            
            if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
                this.hasMoved = true;
            }
            
            this.transform.x += dx;
            this.transform.y += dy;
            this.lastPos = cur;
            this._render();
        });
        
        // Pan - pointer up
        const stopDrag = () => {
            this.dragging = false;
            if (!this.hasMoved) {
                this.canvas.style.cursor = 'pointer';
            }
        };
        this.canvas.addEventListener('pointerup', stopDrag);
        this.canvas.addEventListener('pointerleave', stopDrag);
        
        // Click (tap without drag)
        this.canvas.addEventListener('click', (e) => {
            if (this.hasMoved) return;
            
            const worldPos = this._screenToWorld(e.clientX, e.clientY);
            const hexCoords = pixelToHex(worldPos.x, worldPos.y, this.size);
            const hex = this.hexes.get(`${hexCoords.q},${hexCoords.r}`);
            
            if (hex) {
                this.selectedHex = hex;
                this._render();
                this._emit('select', hex);
            }
        });
        
        // Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const zoomFactor = e.deltaY > 0 ? 1 - ZOOM_FACTOR : 1 + ZOOM_FACTOR;
            const newScale = Math.max(ZOOM_MIN, Math.min(this.transform.scale * zoomFactor, ZOOM_MAX));
            
            // Zoom toward cursor
            const mouseX = e.clientX;
            const mouseY = e.clientY;
            
            const scaleDiff = newScale / this.transform.scale;
            this.transform.x = mouseX - (mouseX - this.transform.x) * scaleDiff;
            this.transform.y = mouseY - (mouseY - this.transform.y) * scaleDiff;
            this.transform.scale = newScale;
            
            this._render();
            this._emit('zoom', { scale: this.transform.scale });
        }, { passive: false });
        
        // Cursor style
        this.canvas.addEventListener('mouseenter', () => {
            this.canvas.style.cursor = 'grab';
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.canvas.style.cursor = 'default';
        });
    }
    
    /**
     * Set hex size
     */
    setSize(size) {
        this.size = size;
        this._generateGrid();
        this._render();
    }
    
    /**
     * Set grid dimensions
     */
    setDimensions(width, height) {
        this.width = width;
        this.height = height;
        this._generateGrid();
        this._render();
    }
    
    /**
     * Reset grid to defaults
     */
    reset() {
        this.size = 30;
        this.width = 15;
        this.height = 10;
        this.selectedHex = null;
        this.transform = { x: 0, y: 0, scale: 1 };
        this._generateGrid();
        this._render();
    }
    
    /**
     * Fill hexes with random colors
     */
    fillRandom() {
        const colors = ['#f0f0f0', '#d4e5d4', '#e5d4d4', '#d4d4e5', '#e5e5d4', '#d4e5e5', '#e8e8e8', '#d0d0d0'];
        this.hexes.forEach(hex => {
            hex.fill = colors[Math.floor(Math.random() * colors.length)];
        });
        this._render();
    }
    
    /**
     * Get hex by coordinates
     */
    getHex(q, r) {
        return this.hexes.get(`${q},${r}`);
    }
    
    /**
     * Get all hexes
     */
    getAllHexes() {
        return Array.from(this.hexes.values());
    }
    
    /**
     * Set hex fill color
     */
    setHexFill(q, r, color) {
        const hex = this.hexes.get(`${q},${r}`);
        if (hex) {
            hex.fill = color;
            this._render();
        }
    }
    
    /**
     * Reset view to default position
     */
    resetView() {
        this.transform = { x: 0, y: 0, scale: 1 };
        this._render();
        this._emit('pan', { x: 0, y: 0 });
        this._emit('zoom', { scale: 1 });
    }
    
    /**
     * Zoom in
     */
    zoomIn() {
        const newScale = Math.min(this.transform.scale * (1 + ZOOM_FACTOR), ZOOM_MAX);
        this.transform.scale = newScale;
        this._render();
        this._emit('zoom', { scale: this.transform.scale });
    }
    
    /**
     * Zoom out
     */
    zoomOut() {
        const newScale = Math.max(this.transform.scale * (1 - ZOOM_FACTOR), ZOOM_MIN);
        this.transform.scale = newScale;
        this._render();
        this._emit('zoom', { scale: this.transform.scale });
    }
    
    /**
     * Get current transform state
     */
    getTransform() {
        return { ...this.transform };
    }
    
    /**
     * Subscribe to events
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    /**
     * Emit events
     */
    _emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}
