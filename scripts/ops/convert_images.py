import os
from PIL import Image

def convert_png_to_webp(directory):
    print(f"Scanning directory: {directory}")
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist!")
        return

    png_files = [f for f in os.listdir(directory) if f.lower().endswith('.png')]
    print(f"Found {len(png_files)} PNG files in {directory}")

    for filename in png_files:
        png_path = os.path.join(directory, filename)
        webp_filename = os.path.splitext(filename)[0] + '.webp'
        webp_path = os.path.join(directory, webp_filename)

        print(f"Converting {filename} -> {webp_filename}...")
        try:
            with Image.open(png_path) as img:
                # Save as WebP with good quality
                img.save(webp_path, 'WEBP', quality=85)
            # Remove original PNG
            os.remove(png_path)
        except Exception as e:
            print(f"Failed to convert {filename}: {e}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    illustrations_dir = os.path.join(base_dir, 'public', 'illustrations')
    banners_dir = os.path.join(base_dir, 'public', 'banners')

    convert_png_to_webp(illustrations_dir)
    convert_png_to_webp(banners_dir)
    print("Image conversion completed successfully.")
