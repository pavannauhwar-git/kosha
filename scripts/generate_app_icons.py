#!/usr/bin/env python3
"""Generate Kosha app icons (PWA) with brand background and bold KOSHA text."""

from PIL import Image, ImageDraw, ImageFont
import os

# Brand color
BRAND = (26, 26, 46)       # #1A1A2E
WHITE = (255, 255, 255)

SIZES = [180, 192, 512]
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def generate_icon(size):
    """Generate a single icon at the given size."""
    # Use 4x supersampling for crisp text
    scale = 4
    canvas_size = size * scale
    img = Image.new('RGBA', (canvas_size, canvas_size), BRAND + (255,))
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background
    radius = int(canvas_size * 0.22)
    draw.rounded_rectangle(
        [(0, 0), (canvas_size - 1, canvas_size - 1)],
        radius=radius,
        fill=BRAND + (255,),
    )

    # Bold KOSHA text
    font_size = int(canvas_size * 0.22)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    text = "KOSHA"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    x = (canvas_size - text_w) / 2
    y = (canvas_size - text_h) / 2 - bbox[1]

    draw.text((x, y), text, font=font, fill=WHITE + (255,))

    # Downsample with high-quality anti-aliasing
    img = img.resize((size, size), Image.LANCZOS)

    output_path = os.path.join(OUTPUT_DIR, f'icon-{size}.png')
    img.save(output_path, 'PNG', optimize=True)
    print(f'  Generated {output_path} ({size}x{size})')


if __name__ == '__main__':
    print('Generating Kosha app icons...')
    for s in SIZES:
        generate_icon(s)
    print('Done.')
