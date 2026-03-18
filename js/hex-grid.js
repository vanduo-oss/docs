// VdHexGrid - Dynamic controllable Hex Grid API for Vanduo framework
// Based on web-civ HexGrid implementation
// Enables developers to use hex grids as components and game devs creating web civ-like games

import { hexToPixel, pixelToHex, getHexCorners, getAdjacentHexes } from './utils/hex-math.js';

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
                    fill: '#e8e8e8',
                    stroke: '#999',
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
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Calculate offset to center the grid
        const padding = this.size * 2;
        const offsetX = padding;
        const offsetY = padding;
        
        // Draw all hexes
        this.hexes.forEach(hex => {
            this._drawHex(hex, offsetX, offsetY);
        });
        
        // Redraw selected hex if any
        if (this.selectedHex) {
            this._drawHex(this.selectedHex, offsetX, offsetY, true);
        }
    }
    
    /**
     * Draw a single hex
     */
    _drawHex(hex, offsetX = 0, offsetY = 0, isSelected = false) {
        const corners = getHexCorners(hex.x + offsetX, hex.y + offsetY, this.size);
        
        this.ctx.beginPath();
        this.ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
            this.ctx.lineTo(corners[i].x, corners[i].y);
        }
        this.ctx.closePath();
        
        // Fill
        this.ctx.fillStyle = isSelected ? '#4a90d9' : (hex.fill || '#e8e8e8');
        this.ctx.fill();
        
        // Stroke
        this.ctx.strokeStyle = isSelected ? '#2c5aa0' : (hex.stroke || '#999');
        this.ctx.lineWidth = isSelected ? 3 : 1;
        this.ctx.stroke();
        
        // Draw coordinates for selected hex
        if (isSelected) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${hex.q},${hex.r}`, hex.x + offsetX, hex.y + offsetY);
        }
    }
    
    /**
     * Set up mouse/touch events for hex selection
     */
    _setupEvents() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            // Calculate offset to center the grid
            const padding = this.size * 2;
            const offsetX = padding;
            const offsetY = padding;
            
            const hexCoords = pixelToHex(x - offsetX, y - offsetY, this.size);
            const hex = this.hexes.get(`${hexCoords.q},${hexCoords.r}`);
            
            if (hex) {
                this.selectedHex = hex;
                this._render();
                this._emit('select', hex);
            }
        });
        
        // Cursor style
        this.canvas.style.cursor = 'pointer';
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
