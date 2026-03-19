import { test, expect } from '@playwright/test';

test.describe('Hex Math Utilities', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('rotatePoint and unrotatePoint are inverse operations', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { rotatePoint, unrotatePoint } = await import('/js/utils/hex-math.js');

            const rotation = -Math.PI / 6;
            const rotated = rotatePoint(30, 40, rotation);
            const original = unrotatePoint(rotated.x, rotated.y, rotation);

            return {
                x: Number(original.x.toFixed(6)),
                y: Number(original.y.toFixed(6))
            };
        });

        expect(result.x).toBeCloseTo(30, 5);
        expect(result.y).toBeCloseTo(40, 5);
    });

    test('hexToPixel converts axial coordinates to pixel coordinates', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { hexToPixel } = await import('/js/utils/hex-math.js');
            return hexToPixel(0, 0, 30);
        });

        expect(result.x).toBe(0);
        expect(result.y).toBe(0);
    });

    test('pixelToHex converts pixel coordinates to axial coordinates', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { pixelToHex } = await import('/js/utils/hex-math.js');
            return pixelToHex(0, 0, 30);
        });

        expect(result.q).toBe(0);
        expect(result.r).toBe(0);
    });

    test('hexToPixel and pixelToHex round-trip without rotation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { hexToPixel, pixelToHex } = await import('/js/utils/hex-math.js');

            const pixel = hexToPixel(2, 3, 30);
            const hex = pixelToHex(pixel.x, pixel.y, 30);

            return { pixel, hex };
        });

        expect(result.pixel.x).toBe(90);
        expect(result.pixel.y).toBeCloseTo(207.846097, 5);
        expect(result.hex.q).toBe(2);
        expect(result.hex.r).toBe(3);
    });

    test('hexToPixel and pixelToHex round-trip with rotation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { hexToPixel, pixelToHex } = await import('/js/utils/hex-math.js');

            const rotation = -Math.PI / 6;
            const pixel = hexToPixel(2, 1, 30, rotation);
            const hex = pixelToHex(pixel.x, pixel.y, 30, rotation);

            return {
                pixel,
                hex,
                rotation
            };
        });

        expect(result.rotation).toBeCloseTo(-Math.PI / 6, 5);
        expect(result.hex.q).toBe(2);
        expect(result.hex.r).toBe(1);
    });

    test('axialRound rounds fractional coordinates correctly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { axialRound } = await import('/js/utils/hex-math.js');

            return {
                hex1: axialRound(0.4, 0.3),
                hex2: axialRound(0.6, 0.7),
                hex3: axialRound(-0.4, -0.3),
                hex4: axialRound(0.2, 0.2)
            };
        });

        expect(result.hex1.q).toBe(1);
        expect(result.hex1.r).toBe(0);
        expect(result.hex2.q).toBe(0);
        expect(result.hex2.r).toBe(1);
        expect(result.hex3.q).toBe(-1);
        expect(result.hex3.r).toBeCloseTo(0, 5);
        expect(result.hex4.q).toBeCloseTo(0, 5);
        expect(result.hex4.r).toBeCloseTo(0, 5);
    });

    test('getHexCorners returns 6 corner points and respects rotation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { getHexCorners } = await import('/js/utils/hex-math.js');

            const corners = getHexCorners(0, 0, 30, Math.PI / 6);

            return {
                count: corners.length,
                first: {
                    x: Number(corners[0].x.toFixed(6)),
                    y: Number(corners[0].y.toFixed(6))
                }
            };
        });

        expect(result.count).toBe(6);
        expect(result.first.x).toBeCloseTo(25.980762, 5);
        expect(result.first.y).toBeCloseTo(15, 5);
    });

    test('getAdjacentHexes returns 6 adjacent hexes in axial order', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { getAdjacentHexes } = await import('/js/utils/hex-math.js');
            return getAdjacentHexes(0, 0);
        });

        expect(result).toEqual([
            { q: 1, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: -1, r: 0 },
            { q: -1, r: 1 },
            { q: 0, r: 1 }
        ]);
    });

    test('hexDistance calculates distance correctly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { hexDistance } = await import('/js/utils/hex-math.js');

            return {
                dist1: hexDistance(0, 0, 0, 0),
                dist2: hexDistance(0, 0, 1, 0),
                dist3: hexDistance(0, 0, 2, 0),
                dist4: hexDistance(0, 0, 1, 1)
            };
        });

        expect(result.dist1).toBe(0);
        expect(result.dist2).toBe(1);
        expect(result.dist3).toBe(2);
        expect(result.dist4).toBe(2);
    });

    test('TerrainType enum has 8 terrain types', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { TerrainType } = await import('/js/utils/hex-math.js');
            return Object.keys(TerrainType).length;
        });

        expect(result).toBe(8);
    });

    test('TERRAIN_COLORS has colors for all terrain types', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { TerrainType, TERRAIN_COLORS } = await import('/js/utils/hex-math.js');
            return Object.values(TerrainType).every((type) => TERRAIN_COLORS[type] !== undefined);
        });

        expect(result).toBe(true);
    });

    test('TERRAIN_YIELDS has yields for all terrain types', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { TerrainType, TERRAIN_YIELDS } = await import('/js/utils/hex-math.js');

            return Object.values(TerrainType).every((type) => {
                const yields = TERRAIN_YIELDS[type];
                return yields
                    && typeof yields.food === 'number'
                    && typeof yields.production === 'number'
                    && typeof yields.gold === 'number';
            });
        });

        expect(result).toBe(true);
    });

    test('TERRAIN_MOVEMENT_COSTS has costs for all terrain types', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { TerrainType, TERRAIN_MOVEMENT_COSTS } = await import('/js/utils/hex-math.js');

            return Object.values(TerrainType).every((type) => typeof TERRAIN_MOVEMENT_COSTS[type] === 'number');
        });

        expect(result).toBe(true);
    });

    test('isPassable returns correct values', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { TerrainType, isPassable } = await import('/js/utils/hex-math.js');

            return {
                grassland: isPassable(TerrainType.GRASSLAND),
                ocean: isPassable(TerrainType.OCEAN),
                mountain: isPassable(TerrainType.MOUNTAIN)
            };
        });

        expect(result.grassland).toBe(true);
        expect(result.ocean).toBe(false);
        expect(result.mountain).toBe(false);
    });

    test('getMovementCost returns correct costs', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { TerrainType, getMovementCost } = await import('/js/utils/hex-math.js');

            return {
                grassland: getMovementCost(TerrainType.GRASSLAND),
                snow: getMovementCost(TerrainType.SNOW),
                ocean: getMovementCost(TerrainType.OCEAN),
                unknown: getMovementCost('UNKNOWN')
            };
        });

        expect(result.grassland).toBe(1);
        expect(result.snow).toBe(2);
        expect(result.ocean).toBe(999);
        expect(result.unknown).toBe(999);
    });

    test('getTerrainYields returns correct yields', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { TerrainType, getTerrainYields } = await import('/js/utils/hex-math.js');

            return {
                grassland: getTerrainYields(TerrainType.GRASSLAND),
                plains: getTerrainYields(TerrainType.PLAINS),
                desert: getTerrainYields(TerrainType.DESERT),
                unknown: getTerrainYields('UNKNOWN')
            };
        });

        expect(result.grassland.food).toBe(2);
        expect(result.grassland.production).toBe(0);
        expect(result.plains.food).toBe(1);
        expect(result.plains.production).toBe(1);
        expect(result.desert.food).toBe(0);
        expect(result.desert.production).toBe(1);
        expect(result.unknown).toEqual({ food: 0, production: 0, gold: 0 });
    });

    test('getTerrainColor returns correct colors', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { TerrainType, getTerrainColor } = await import('/js/utils/hex-math.js');

            return {
                grassland: getTerrainColor(TerrainType.GRASSLAND),
                ocean: getTerrainColor(TerrainType.OCEAN),
                unknown: getTerrainColor('UNKNOWN')
            };
        });

        expect(result.grassland).toBe('#47602f');
        expect(result.ocean).toBe('#1d354c');
        expect(result.unknown).toBe('#FF00FF');
    });
});
