import os
import sys
import glob
import time
import math
import uuid
import json
import base64
import shutil
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from flask_cors import CORS
from functools import wraps

import cv2
import numpy as np
import PIL
import PIL._util

# Fix Pillow 11+ compatibility if needed
if not hasattr(PIL._util, 'is_directory'):
    PIL._util.is_directory = lambda path: isinstance(path, (str, bytes, os.PathLike)) and os.path.isdir(path)
if not hasattr(PIL._util, 'is_path'):
    PIL._util.is_path = lambda path: isinstance(path, (str, bytes, os.PathLike))

from PIL import Image

import torch
import torch.nn as nn
import torchvision.transforms as transforms

import timm
from facenet_pytorch import MTCNN

import database as db

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = "deepfake-detection-secret-key-2026"
CORS(app)

# Paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
UPLOAD_FOLDER = BASE_DIR / "static" / "uploads"
THUMBNAIL_FOLDER = BASE_DIR / "static" / "thumbnails"

UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
THUMBNAIL_FOLDER.mkdir(parents=True, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1 GB max file size

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "ขนาดไฟล์เกินขีดจำกัดที่ระบบรองรับ (สูงสุด 1 GB)"}), 413

# Device configuration
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Server running on device: {device}")

# Initialize MTCNN for face cropping
mtcnn = MTCNN(
    image_size=299,
    margin=40,
    min_face_size=60,
    post_process=False,
    device=device
)

# Models cache
MODELS = {}

# Initialize database (JSON files)
db.init_db()

# Image transformation (Xception standard)
transform = transforms.Compose([
    transforms.Resize((299, 299)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])

class XceptionDeepfakeClassifier(nn.Module):
    def __init__(self, num_classes=2, dropout_p=0.4, pretrained=False):
        super().__init__()
        self.backbone = timm.create_model("legacy_xception", pretrained=pretrained)
        in_features = self.backbone.get_classifier().in_features
        self.backbone.fc = nn.Sequential(
            nn.Dropout(dropout_p),
            nn.Linear(in_features, num_classes)
        )

    def forward(self, x):
        return self.backbone(x)


def load_xception_model(model_path):
    try:
        checkpoint = torch.load(model_path, map_location=device, weights_only=False)
    except TypeError:
        checkpoint = torch.load(model_path, map_location=device)
    
    state_dict = checkpoint["model_state_dict"] if (isinstance(checkpoint, dict) and "model_state_dict" in checkpoint) else checkpoint
    sample_key = next(iter(state_dict.keys()))
    
    if sample_key.startswith("backbone."):
        model = XceptionDeepfakeClassifier(num_classes=2, pretrained=False)
        model.load_state_dict(state_dict)
    else:
        model = timm.create_model("legacy_xception", pretrained=False, num_classes=2)
        model.load_state_dict(state_dict)
        
    model.to(device)
    model.eval()
    return model

def get_loaded_model(technique_key):
    """Get loaded model or load on demand (uses database for active models)"""
    if technique_key not in MODELS:
        active = db.get_active_models()
        file_name = active.get(technique_key)
        if not file_name:
            # Fallback to first available active model
            if active:
                first_key = list(active.keys())[0]
                technique_key = first_key
                file_name = active[first_key]
            else:
                raise FileNotFoundError("No active models available")
            
        full_path = MODEL_DIR / file_name
        if not full_path.exists():
            raise FileNotFoundError(f"Model file not found: {full_path}")
            
        print(f"Loading model '{technique_key}' from {full_path}...")
        MODELS[technique_key] = load_xception_model(str(full_path))
        
    return MODELS[technique_key]

def extract_face(frame_bgr):
    """Extract face using MTCNN with center-crop fallback"""
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_frame = Image.fromarray(frame_rgb)
    
    try:
        face = mtcnn(pil_frame)
        if face is not None:
            face_np = face.permute(1, 2, 0).cpu().numpy().astype(np.uint8)
            return Image.fromarray(face_np)
    except Exception as e:
        pass
        
    # Fallback: Center crop square
    h, w, _ = frame_bgr.shape
    side = min(h, w)
    cy, cx = h // 2, w // 2
    y1, y2 = max(0, cy - side // 2), min(h, cy + side // 2)
    x1, x2 = max(0, cx - side // 2), min(w, cx + side // 2)
    crop_rgb = frame_rgb[y1:y2, x1:x2]
    crop_pil = Image.fromarray(crop_rgb).resize((299, 299))
    return crop_pil

def cleanup_uploaded_files():
    """Delete all files in uploads and thumbnails folders after analysis."""
    for folder in [UPLOAD_FOLDER, THUMBNAIL_FOLDER]:
        for f in folder.iterdir():
            try:
                if f.is_file():
                    f.unlink()
            except Exception as e:
                print(f"Warning: Could not delete {f}: {e}")

def analyze_video(video_path, num_frames=12):
    """
    Sample frames from video, extract faces using MTCNN, run ALL active Xception models,
    and compute per-model Real/Fake percentages.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video file.")
        
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    duration_sec = total_frames / fps
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    if total_frames <= 0:
        cap.release()
        raise ValueError("Video has no frames.")
        
    # Use active models from database
    active_model_names = db.get_active_models()
    if not active_model_names:
        cap.release()
        raise ValueError("No active models available. Please activate at least one model in the admin panel.")

    active_keys = list(active_model_names.keys())
    models_dict = {k: get_loaded_model(k) for k in active_keys}
    
    # Get display names from database
    display_names = db.get_active_display_names()
    
    # Frame sampling indices
    frame_indices = np.linspace(0, total_frames - 1, num=min(num_frames, total_frames), dtype=int)
    
    frame_results = []
    video_id = str(uuid.uuid4())[:8]
    
    # Per-model accumulators: {model_key: [real_prob_per_frame, ...]}
    per_model_real_probs = {k: [] for k in active_keys}
    per_model_fake_probs = {k: [] for k in active_keys}
    
    all_fake_probs = []
    all_real_probs = []
    
    # Keep track of first thumbnail for log
    first_thumbnail_url = ""
    
    for i, frame_idx in enumerate(frame_indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame_bgr = cap.read()
        if not ret:
            continue
            
        face_pil = extract_face(frame_bgr)
        
        # Save face thumbnail
        thumb_filename = f"thumb_{video_id}_frame{i:02d}.jpg"
        thumb_path = THUMBNAIL_FOLDER / thumb_filename
        face_pil.save(str(thumb_path), quality=90)
        
        thumb_url = f"/static/thumbnails/{thumb_filename}"
        if i == 0:
            first_thumbnail_url = thumb_url
        
        # Model Inference
        input_tensor = transform(face_pil).unsqueeze(0).to(device)
        
        frame_fake_probs = []
        frame_real_probs = []
        
        with torch.no_grad():
            for k in active_keys:
                m = models_dict[k]
                outputs = m(input_tensor)
                probs = torch.softmax(outputs, dim=1)[0]
                real_p = probs[0].item()
                fake_p = probs[1].item()
                frame_real_probs.append(real_p)
                frame_fake_probs.append(fake_p)
                per_model_real_probs[k].append(real_p)
                per_model_fake_probs[k].append(fake_p)
                
        avg_real = float(np.mean(frame_real_probs))
        avg_fake = float(np.mean(frame_fake_probs))
        
        all_real_probs.append(avg_real)
        all_fake_probs.append(avg_fake)
        
        timestamp_sec = frame_idx / fps
        time_str = f"{int(timestamp_sec // 60):02d}:{int(timestamp_sec % 60):02d}"
        
        frame_results.append({
            "frame_index": int(frame_idx),
            "timestamp": time_str,
            "thumbnail_url": thumb_url,
            "real_pct": round(avg_real * 100, 1),
            "fake_pct": round(avg_fake * 100, 1),
            "is_fake": avg_fake > 0.5
        })
        
    cap.release()
    
    if not all_fake_probs:
        raise ValueError("Could not extract any valid faces/frames from the video.")
        
    final_fake_pct = float(np.mean(all_fake_probs)) * 100
    final_real_pct = float(np.mean(all_real_probs)) * 100
    
    # Normalize sum to 100%
    total_pct = final_real_pct + final_fake_pct
    if total_pct > 0:
        final_real_pct = round((final_real_pct / total_pct) * 100, 1)
        final_fake_pct = round((final_fake_pct / total_pct) * 100, 1)
    else:
        final_real_pct = 50.0
        final_fake_pct = 50.0
        
    is_fake = final_fake_pct > 50.0
    verdict = "DEEPFAKE DETECTED" if is_fake else "REAL VIDEO"
    confidence = final_fake_pct if is_fake else final_real_pct
    
    # Build per-model results
    model_results = []
    for k in active_keys:
        if per_model_real_probs[k]:
            m_real = float(np.mean(per_model_real_probs[k])) * 100
            m_fake = float(np.mean(per_model_fake_probs[k])) * 100
            # Normalize
            m_total = m_real + m_fake
            if m_total > 0:
                m_real = round((m_real / m_total) * 100, 1)
                m_fake = round((m_fake / m_total) * 100, 1)
            model_results.append({
                "key": k,
                "name": display_names.get(k, k),
                "real_pct": m_real,
                "fake_pct": m_fake,
                "is_fake": m_fake > 50.0
            })
    
    # Sort by real_pct descending (highest confidence real first)
    model_results.sort(key=lambda x: x["real_pct"], reverse=True)
    
    return {
        "verdict": verdict,
        "is_fake": is_fake,
        "confidence": confidence,
        "real_pct": final_real_pct,
        "fake_pct": final_fake_pct,
        "model_results": model_results,
        "video_info": {
            "duration": f"{duration_sec:.1f}s",
            "resolution": f"{width}x{height}",
            "total_frames": total_frames,
            "fps": round(fps, 1),
            "analyzed_frames": len(frame_results)
        },
        "frames": frame_results,
        "technique_used": "ensemble",
        "first_thumbnail": first_thumbnail_url
    }

# ──────────────────────────────────────────────────────────────────────
#  Admin auth decorator
# ──────────────────────────────────────────────────────────────────────

def admin_required(f):
    """Decorator to protect admin-only endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            if request.is_json or request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized", "login_required": True}), 401
            return redirect(url_for("admin_login_page"))
        return f(*args, **kwargs)
    return decorated

# ──────────────────────────────────────────────────────────────────────
#  Public routes
# ──────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/analyze", methods=["POST"])
def analyze_endpoint():
    if "video" not in request.files:
        return jsonify({"error": "No video file provided"}), 400
        
    file = request.files["video"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    
    original_filename = file.filename
        
    # Save file
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = UPLOAD_FOLDER / filename
    file.save(str(filepath))
    
    try:
        results = analyze_video(str(filepath))
        results["video_url"] = f"/static/uploads/{filename}"
        
        # Log detection to stats (JSON)
        db.log_detection(
            filename=original_filename,
            is_fake=results["is_fake"],
            confidence=results["confidence"],
            real_pct=results["real_pct"],
            fake_pct=results["fake_pct"],
            duration=results["video_info"]["duration"],
            resolution=results["video_info"]["resolution"],
            analyzed_frames=results["video_info"]["analyzed_frames"],
            thumbnail_url=results.get("first_thumbnail", "")
        )
        
        # Cleanup uploaded files and thumbnails after analysis
        cleanup_uploaded_files()
        
        # Clear thumbnail URLs from results since files are deleted
        # The frontend already has the data it needs from the response
        
        return jsonify(results)
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Cleanup even on error
        cleanup_uploaded_files()
        return jsonify({"error": str(e)}), 500

@app.route("/api/models", methods=["GET"])
def models_endpoint():
    models = db.get_all_models()
    available = []
    for m in models:
        exists = (MODEL_DIR / m["filename"]).exists()
        available.append({
            "key": m["key"],
            "name": m["name"],
            "file": m["filename"],
            "available": exists,
            "is_active": m.get("is_active", True)
        })
    return jsonify({
        "models": available,
        "ensemble_available": any(m["available"] and m["is_active"] for m in available)
    })

# ──────────────────────────────────────────────────────────────────────
#  Admin routes
# ──────────────────────────────────────────────────────────────────────

@app.route("/admin")
def admin_login_page():
    if session.get("admin_logged_in"):
        return render_template("admin.html")
    return render_template("admin.html")

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")
    
    if db.verify_admin(username, password):
        session["admin_logged_in"] = True
        session["admin_user"] = username
        return jsonify({"success": True, "message": "Login successful"})
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("admin_logged_in", None)
    session.pop("admin_user", None)
    return jsonify({"success": True})

@app.route("/api/admin/check", methods=["GET"])
def admin_check():
    """Check if admin is logged in."""
    return jsonify({"logged_in": bool(session.get("admin_logged_in"))})

@app.route("/api/admin/stats", methods=["GET"])
@admin_required
def admin_stats():
    stats = db.get_system_stats()
    return jsonify(stats)

@app.route("/api/admin/history", methods=["GET"])
@admin_required
def admin_history():
    limit = request.args.get("limit", 50, type=int)
    history = db.get_detection_history(limit)
    return jsonify({"logs": history})

@app.route("/api/admin/models", methods=["GET"])
@admin_required
def admin_models():
    models = db.get_all_models()
    result = []
    for m in models:
        fpath = MODEL_DIR / m["filename"]
        file_size = 0
        file_exists = fpath.exists()
        if file_exists:
            file_size = fpath.stat().st_size
        result.append({
            **m,
            "file_exists": file_exists,
            "file_size_mb": round(file_size / (1024 * 1024), 1) if file_size else 0
        })
    return jsonify({"models": result})

@app.route("/api/admin/models/upload", methods=["POST"])
@admin_required
def admin_upload_model():
    if "model_file" not in request.files:
        return jsonify({"error": "No model file provided"}), 400
    
    file = request.files["model_file"]
    key = request.form.get("key", "").strip().lower().replace(" ", "_")
    name = request.form.get("name", "").strip()
    description = request.form.get("description", "").strip()
    
    if not key or not name:
        return jsonify({"error": "Model key and name are required"}), 400
    
    if not file.filename.endswith(".pth"):
        return jsonify({"error": "Only .pth files are supported"}), 400
    
    # Save model file
    filename = f"xception_{name.replace(' ', '')}.pth"
    filepath = MODEL_DIR / filename
    file.save(str(filepath))
    
    # Register in database
    success, msg = db.add_model(key, name, filename, description)
    if not success:
        # Remove uploaded file if registration failed
        if filepath.exists():
            filepath.unlink()
        return jsonify({"error": msg}), 400
    
    return jsonify({"success": True, "message": f"Model '{name}' added successfully"})

@app.route("/api/admin/models/<key>", methods=["DELETE"])
@admin_required
def admin_delete_model(key):
    deleted = db.delete_model(key)
    if not deleted:
        return jsonify({"error": "Model not found"}), 404
    
    # Remove file from disk
    filepath = MODEL_DIR / deleted["filename"]
    if filepath.exists():
        try:
            filepath.unlink()
        except Exception as e:
            print(f"Warning: Could not delete model file {filepath}: {e}")
    
    # Remove from in-memory cache
    MODELS.pop(key, None)
    
    return jsonify({"success": True, "message": f"Model '{deleted['name']}' deleted"})

@app.route("/api/admin/models/<key>/toggle", methods=["PATCH"])
@admin_required
def admin_toggle_model(key):
    new_state = db.toggle_model(key)
    if new_state is None:
        return jsonify({"error": "Model not found"}), 404
    
    # If deactivated, remove from in-memory cache
    if not new_state:
        MODELS.pop(key, None)
    
    return jsonify({
        "success": True,
        "key": key,
        "is_active": new_state,
        "message": f"Model {'activated' if new_state else 'deactivated'}"
    })

if __name__ == "__main__":
    print("=" * 60)
    print("  Facial Deepfake Detection System Server")
    print("  Models directory:", MODEL_DIR)
    print("  Device:", device)
    print("=" * 60)
    db.init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)

