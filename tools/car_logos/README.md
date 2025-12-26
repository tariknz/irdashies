# Car Logo Sprite Sheet Generator

This script creates a sprite sheet from individual car manufacturer logo PNG files and generates a TypeScript mapping file for use in the frontend.

## Overview

The script processes all PNG files in the `logos/` directory, resizes them to 128x128 pixels (maintaining aspect ratio), and arranges them in a grid-based sprite sheet. It also generates a TypeScript file with sprite position mappings.

## Requirements

- Python 3
- Pillow (PIL) - Image processing library

Install dependencies:
```bash
pip install Pillow
```

Or if using the project's dependency management:
```bash
# From the project root
uv sync
```

## Usage

Run the script from the `tools/car_logos/` directory:

```bash
python create_sprite_sheet.py
```

Or make it executable and run directly:

```bash
chmod +x create_sprite_sheet.py
./create_sprite_sheet.py
```

## Input

Place car manufacturer logo PNG files in the `logos/` directory. The filename (without extension) will be used as the manufacturer identifier in the TypeScript mapping.

Example:
- `logos/acura.png` → manufacturer key: `acura`
- `logos/ferrari.png` → manufacturer key: `ferrari`

## Output

The script generates two files:

1. **Sprite Sheet Image**
   - Location: `src/frontend/assets/car_manufacturer.png`
   - Format: PNG with RGBA transparency
   - Grid layout: Automatically calculated to fit all logos (approximately square grid)
   - Sprite size: 128x128 pixels per logo

2. **TypeScript Position Mapping**
   - Location: `src/frontend/components/Standings/components/CarManufacturer/spritePositions.ts`
   - Exports:
     - `SPRITE_SIZE`: Size of each sprite (128)
     - `SPRITES_PER_ROW`: Number of sprites per row
     - `SPRITES_PER_COLUMN`: Number of sprites per column
     - `CAR_MANUFACTURER_SPRITE_POSITIONS`: Record mapping manufacturer names to grid positions `{ x: number, y: number }`

## Sprite Sheet Layout

- The first position (0, 0) is reserved for the "unknown" manufacturer
- Logos are arranged in a grid starting from position (1, 0)
- Each logo is centered within its 128x128 cell
- Logos maintain their aspect ratio and are padded with transparency

## Example TypeScript Output

```typescript
export const SPRITE_SIZE = 128;
export const SPRITES_PER_ROW = 7;
export const SPRITES_PER_COLUMN = 6;

export const CAR_MANUFACTURER_SPRITE_POSITIONS: Record<string, { x: number; y: number }> = {
  acura: { x: 1, y: 0 },
  ferrari: { x: 3, y: 1 },
  // ... etc
};
```

## Updating Car Manufacturer Mapping

After generating the sprite sheet, you may need to update the car-to-manufacturer mapping file:

**Location**: `src/frontend/components/Standings/components/CarManufacturer/carManufacturerMapping.ts`

This file maps car IDs to their manufacturer names. When adding new cars or updating existing ones:

1. Ensure the manufacturer name in the mapping matches the logo filename (without extension)
2. The manufacturer key must exist in `CAR_MANUFACTURER_SPRITE_POSITIONS` from `spritePositions.ts`
3. Use `'unknown'` for cars without a specific manufacturer logo

Example:
```typescript
export const CAR_ID_TO_CAR_MANUFACTURER: Record<number, { name: string; manufacturer: string }> = {
  170: { name: 'Acura ARX-06 GTP', manufacturer: 'acura' },
  173: { name: 'Ferrari 296 GT3', manufacturer: 'ferrari' },
  // ... etc
};
```

**Important**: If you add a new manufacturer logo, make sure to:
1. Add the logo PNG file to `logos/` directory
2. Run the sprite sheet generator script
3. Update `carManufacturerMapping.ts` to use the new manufacturer key for relevant cars

## Notes

- The script automatically handles image format conversion to RGBA
- Logos are resized using LANCZOS resampling for high quality
- Duplicate manufacturer names (if multiple files have the same base name) will use the first processed logo
- The grid dimensions are calculated to be approximately square for optimal space usage

