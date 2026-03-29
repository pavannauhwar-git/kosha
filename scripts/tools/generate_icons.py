"""Generate KOSHA PWA icons — flat brand colour with bold centred KOSHA text."""
from PIL import Image, ImageDraw, ImageFont
import os

SIZES = [180, 192, 512]
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')

# Current brand colour: Periwinkle Violet #243BAF
BRAND = (0x24, 0x3B, 0xAF)

def generate_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Solid brand fill
    draw.rectangle([0, 0, size, size], fill=(*BRAND, 255))

    # Round corners (iOS-style ~22% radius)
    corner_radius = round(size * 0.22)
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_radius, fill=255)
    img.putalpha(mask)

    # Bold white KOSHA text — sized so it fills ~60% of the icon width
    text = "KOSHA"
    font_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts', 'Roboto-Black.ttf')
    target_width = size * 0.60

    # Binary-search for the font size that hits ~60% icon width
    lo, hi = 4, size
    font = ImageFont.load_default()
    for _ in range(18):
        mid = (lo + hi) // 2
        try:
            candidate = ImageFont.truetype(font_path, mid)
        except (IOError, OSError):
            break
        bbox = ImageDraw.Draw(img).textbbox((0, 0), text, font=candidate)
        tw = bbox[2] - bbox[0]
        if tw < target_width:
            lo = mid
            font = candidate
        else:
            hi = mid
        if hi - lo <= 1:
            break

    text_draw = ImageDraw.Draw(img)
    bbox = text_draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
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
