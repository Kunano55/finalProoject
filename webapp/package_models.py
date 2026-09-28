import zipfile
import os
import sys

model_dir = r"c:\school_code\finalProject\webapp\model"
folders = ["xception_Deepfakes", "xception_Face2Face", "xception_FaceShifter", "xception_NeuralTextures"]

for folder_name in folders:
    folder_path = os.path.join(model_dir, folder_name)
    pth_path = os.path.join(model_dir, f"{folder_name}.pth")
    if os.path.exists(folder_path):
        print(f"Packaging {folder_name} -> {folder_name}.pth...")
        with zipfile.ZipFile(pth_path, 'w', compression=zipfile.ZIP_STORED) as zf:
            for root, dirs, files in os.walk(folder_path):
                for f in files:
                    full_f = os.path.join(root, f)
                    rel_f = os.path.relpath(full_f, folder_path)
                    archive_f = os.path.join("archive", rel_f)
                    zf.write(full_f, archive_f)
        print(f"Successfully created {pth_path} ({os.path.getsize(pth_path) / (1024*1024):.1f} MB)")
