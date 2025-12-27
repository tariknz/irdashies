#!/usr/bin/env python3
"""
Script to create a sprite sheet from car logos.
Each logo is resized to 256x256 pixels (2x for retina displays) and arranged in a grid.
"""

import os
from PIL import Image
import math

LOGO_DIR = "logos"
SPRITE_SIZE = 256
OUTPUT_FILE = "../../src/frontend/assets/img/car_manufacturer.png"
TS_OUTPUT_FILE = "../../src/frontend/components/Standings/components/CarManufacturer/carManufacturerSpritePositions.ts"

def resize_logo(img, target_size):
    """Resize logo to target_size x target_size while maintaining aspect ratio."""
    img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
    
    new_img = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    
    x_offset = (target_size - img.width) // 2
    y_offset = (target_size - img.height) // 2
    
    new_img.paste(img, (x_offset, y_offset), img if img.mode == "RGBA" else None)
    return new_img

def generate_typescript_mapping(positions, sprites_per_row, sprites_per_column):
    """Generate TypeScript file with sprite positions."""
    ts_content = f"""export const SPRITE_SIZE = {SPRITE_SIZE};
export const SPRITES_PER_ROW = {sprites_per_row};
export const SPRITES_PER_COLUMN = {sprites_per_column};

export const CAR_MANUFACTURER_SPRITE_POSITIONS: Record<string, {{ x: number; y: number }}> = {{
"""
    
    for manufacturer, (x, y) in sorted(positions.items()):
        ts_content += f"  {manufacturer}: {{ x: {x}, y: {y} }},\n"
    
    ts_content += """};

"""
    
    with open(TS_OUTPUT_FILE, 'w') as f:
        f.write(ts_content)
    
    print(f"TypeScript mapping created: {TS_OUTPUT_FILE}")

def create_sprite_sheet():
    """Create a sprite sheet from all logos in the logos directory."""
    logo_files = sorted([f for f in os.listdir(LOGO_DIR) if f.endswith('.png')])
    
    if not logo_files:
        print(f"No PNG files found in {LOGO_DIR}")
        return
    
    print(f"Found {len(logo_files)} logo files")
    
    total_sprites = len(logo_files) + 1
    cols = math.ceil(math.sqrt(total_sprites))
    rows = math.ceil(total_sprites / cols)
    
    sprite_sheet = Image.new("RGBA", (cols * SPRITE_SIZE, rows * SPRITE_SIZE), (0, 0, 0, 0))
    positions = {}
    
    positions["unknown"] = (0, 0)
    
    for idx, logo_file in enumerate(logo_files):
        logo_path = os.path.join(LOGO_DIR, logo_file)
        
        try:
            img = Image.open(logo_path)
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            
            resized = resize_logo(img, SPRITE_SIZE)
            
            sprite_idx = idx + 1
            col = sprite_idx % cols
            row = sprite_idx // cols
            
            x = col * SPRITE_SIZE
            y = row * SPRITE_SIZE
            
            sprite_sheet.paste(resized, (x, y), resized)
            
            manufacturer = os.path.splitext(logo_file)[0]
            
            if manufacturer not in positions:
                positions[manufacturer] = (col, row)
            
            print(f"Processed {logo_file} -> position ({col}, {row}) -> {manufacturer}")
            
        except Exception as e:
            print(f"Error processing {logo_file}: {e}")
    
    sprite_sheet.save(OUTPUT_FILE, "PNG")
    print(f"\nSprite sheet created: {OUTPUT_FILE}")
    print(f"Dimensions: {sprite_sheet.width}x{sprite_sheet.height}")
    print(f"Grid: {cols} columns x {rows} rows")
    print(f"Total logos: {len(logo_files)}")
    
    generate_typescript_mapping(positions, cols, rows)

if __name__ == "__main__":
    create_sprite_sheet()
