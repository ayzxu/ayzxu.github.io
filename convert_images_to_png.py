import os
from PIL import Image
import glob

def convert_jpg_to_png(directory):
    """Convert all JPG/JPEG files to PNG in the given directory and subdirectories"""
    # Find all jpg, jpeg, JPG, JPEG files
    patterns = ['**/*.jpg', '**/*.jpeg', '**/*.JPG', '**/*.JPEG']
    converted_files = []
    
    for pattern in patterns:
        for jpg_path in glob.glob(os.path.join(directory, pattern), recursive=True):
            try:
                # Open the image
                img = Image.open(jpg_path)
                
                # Create PNG path (replace extension)
                png_path = os.path.splitext(jpg_path)[0] + '.png'
                
                # Convert and save as PNG
                # Convert to RGB if necessary (for RGBA or other modes)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Keep transparency if present
                    img.save(png_path, 'PNG')
                else:
                    # Convert to RGB for standard images
                    rgb_img = img.convert('RGB')
                    rgb_img.save(png_path, 'PNG')
                
                converted_files.append((jpg_path, png_path))
                print(f"Converted: {jpg_path} -> {png_path}")
                
            except Exception as e:
                print(f"Error converting {jpg_path}: {e}")
    
    return converted_files

if __name__ == '__main__':
    # Convert images in src/assets directory
    src_dir = os.path.join(os.path.dirname(__file__), 'src', 'assets')
    public_dir = os.path.join(os.path.dirname(__file__), 'public')
    
    print("Converting images in src/assets...")
    converted_src = convert_jpg_to_png(src_dir)
    
    print("\nConverting images in public...")
    converted_public = convert_jpg_to_png(public_dir)
    
    all_converted = converted_src + converted_public
    
    print(f"\n\nConversion complete! Converted {len(all_converted)} files.")
    print("\nConverted files:")
    for old, new in all_converted:
        print(f"  {old} -> {new}")
    
    print("\n\nNote: Original JPG files are still present. You may want to delete them after verifying the PNGs work correctly.")

