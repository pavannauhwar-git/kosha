#!/usr/bin/env python3
"""Generate Kosha app icons (PWA) with brand background and white slash-dot logo."""

from PIL import Image, ImageDraw
import os

# Brand color (matches --ds-primary: #007FFF)
BRAND = (0, 127, 255)
WHITE = (255, 255, 255)
ACCENT = (255, 255, 153)

SIZES = [180, 192, 512]
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def draw_slash_dot_logo(draw, canvas_size):
    """Draw a centered, bold /. mark with yellow contrast dot."""
    # Base shape designed at 512 and scaled proportionally.
    scale_up = 1.33
    unit = (canvas_size / 512.0) * scale_up

    slash_base = [
        (-118.0, 128.0),
        (-70.0, 152.0),
        (72.0, -26.0),
        (24.0, -50.0),
    ]
    # Move dot lower and closer to slash.
    dot_c_base = (84.0, 108.0)
    dot_r_base = 46.0

    all_x = [p[0] for p in slash_base] + [dot_c_base[0] - dot_r_base, dot_c_base[0] + dot_r_base]
    all_y = [p[1] for p in slash_base] + [dot_c_base[1] - dot_r_base, dot_c_base[1] + dot_r_base]
    shape_cx = (min(all_x) + max(all_x)) / 2.0
    shape_cy = (min(all_y) + max(all_y)) / 2.0

    slash = [
        (
            int((x - shape_cx) * unit + canvas_size * 0.5),
            int((y - shape_cy) * unit + canvas_size * 0.5),
        )
        for x, y in slash_base
    ]
    draw.polygon(slash, fill=WHITE + (255,))

    dot_r = int(dot_r_base * unit)
    cx = int((dot_c_base[0] - shape_cx) * unit + canvas_size * 0.5)
    cy = int((dot_c_base[1] - shape_cy) * unit + canvas_size * 0.5)
    draw.ellipse(
        (cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r),
        fill=ACCENT + (255,),
    )


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

    # /. logo symbol
    draw_slash_dot_logo(draw, canvas_size)

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
