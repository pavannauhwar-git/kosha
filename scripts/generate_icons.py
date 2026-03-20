"""Generate KOSHA PWA icons with the hero card gradient background."""
from PIL import Image, ImageDraw, ImageFont
import math, os

SIZES = [180, 192, 512]
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')

# Hero card gradient: #3730A3 -> #5B51E0 at 145deg
START = (0x37, 0x30, 0xA3)  # brand
END   = (0x5B, 0x51, 0xE0)  # brandMid

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def generate_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw gradient at 145 degrees
    angle_rad = math.radians(145)
    cos_a, sin_a = math.cos(angle_rad), math.sin(angle_rad)

    for y in range(size):
        for x in range(size):
            # Project pixel onto gradient axis
            t = (x * cos_a + y * sin_a) / (size * (abs(cos_a) + abs(sin_a)))
            t = max(0.0, min(1.0, t))
            color = lerp_color(START, END, t)
            img.putpixel((x, y), (*color, 255))

    # Round corners
    corner_radius = round(size * 0.22)
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_radius, fill=255)
    img.putalpha(mask)

    # Draw thick bold white KOSHA text
    text = "KOSHA"
    font_size = round(size * 0.20)
    font_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts', 'Roboto-Black.ttf')
    try:
        font = ImageFont.truetype(font_path, font_size)
    except (IOError, OSError):
        font = ImageFont.load_default()

    text_draw = ImageDraw.Draw(img)
    bbox = text_draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) / 2
    ty = (size - th) / 2 - bbox[1]
    text_draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)

    return img

os.makedirs(OUT_DIR, exist_ok=True)

for s in SIZES:
    icon = generate_icon(s)
    path = os.path.join(OUT_DIR, f'icon-{s}.png')
    icon.save(path, 'PNG')
    print(f"  Created {path} ({s}x{s})")

# Create favicon by downscaling the 192px icon
favicon_src = generate_icon(192)
favicon_32 = favicon_src.resize((32, 32), Image.LANCZOS)
favicon_path = os.path.join(OUT_DIR, '..', 'favicon.ico')
favicon_32.save(favicon_path, 'ICO', sizes=[(32, 32)])
print(f"  Created {favicon_path} (favicon.ico)")

print("Done — all icons generated.")
