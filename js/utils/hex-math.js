// Hex math utilities adapted for Vanduo framework
// Based on web-civ utils/hex-math.js

export function hexToPixel(q, r, size) {
    const baseX = size * 1.5 * q;
    const baseY = size * Math.sqrt(3) * (r + q * 0.5);
    // No rotation for Vanduo (default orientation)
    return { x: baseX, y: baseY };
}

export function pixelToHex(px, py, size) {
    const q = (2 / 3 * px) / size;
    const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / size;
    return axialRound(q, r);
}

export function axialRound(q, r) {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);
    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);
    if (qDiff > rDiff && qDiff > sDiff) {
        rq = -rr - rs;
    } else if (rDiff > sDiff) {
        rr = -rq - rs;
    }
    return { q: rq, r: rr };
}

export function getHexCorners(x, y, size) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angleDeg = 60 * i;
        const angleRad = (Math.PI / 180) * angleDeg;
        corners.push({
            x: x + size * Math.cos(angleRad),
            y: y + size * Math.sin(angleRad)
        });
    }
    return corners;
}

export function getAdjacentHexes(q, r) {
    return [
        { q: q + 1, r: r },
        { q: q + 1, r: r - 1 },
        { q: q, r: r - 1 },
        { q: q - 1, r: r },
        { q: q - 1, r: r + 1 },
        { q: q, r: r + 1 }
    ];
}
