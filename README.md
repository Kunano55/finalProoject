# Facial Deepfake Video Detection System Using Artificial Intelligence

ระบบตรวจจับวิดีโอดีปเฟกใบหน้าด้วยปัญญาประดิษฐ์ (Xception + MTCNN)

A full-stack Deepfake Video Detection Web Application using Deep Learning (Xception architecture) and Face Detection (MTCNN).

---

## 📌 System Architecture

```
User / Admin
     │
     ▼
Frontend (HTML5 / Modern CSS / Vanilla JS)
     │
     ▼
Flask REST API Backend (webapp/server.py)
     │
     ├── Face Detection & Extraction (MTCNN / facenet-pytorch)
     ├── Deepfake Classification (PyTorch / Xception Backbone)
     └── Database Management (webapp/database.py -> MySQL)
```

---

## 📁 Repository Structure

```
finalProject/
├── webapp/
│   ├── server.py              # Main Flask application and AI inference pipeline
│   ├── database.py            # MySQL database connection and CRUD operations
│   ├── package_models.py      # Model packaging utility
│   ├── requirements.txt       # Python package dependencies
│   ├── data/
│   │   ├── schema.sql         # MySQL database schema (admins, models, detection_logs)
│   │   ├── admin.json         # Seed admin credentials
│   │   ├── models.json        # AI model registry seed data
│   │   └── detection_logs.json# Sample detection history logs
│   ├── model/
│   │   └── README.md          # Guide for placement of .pth trained weights
│   ├── static/
│   │   ├── css/style.css      # Responsive UI styling
│   │   ├── js/main.js         # User video analysis client logic
│   │   └── js/admin.js        # Admin management client logic
│   └── templates/
│       ├── index.html         # User detection interface
│       └── admin.html         # Admin dashboard interface
├── .gitignore                 # Excludes heavy binaries, caches, and uploads
└── README.md                  # Project documentation
```

---

## 🚀 Key Features

1. **User Video Analysis**:
   - Accepts `.mp4`, `.avi`, `.mov` video files (5–60s duration).
   - Uniformly samples 12 frames across video timeline.
   - MTCNN detects and aligns 5 facial landmarks, cropping faces to 299×299.
   - Xception backbone performs binary classification (`Real` vs `Fake`).
   - Confidence scoring and detailed breakdown.

2. **Admin Management Dashboard**:
   - Authentication & session control.
   - Overview statistics (total uploads, real vs fake ratio, daily trends).
   - Detection history logs with thumbnails and search/filtering.
   - Model management: upload `.pth` models, toggle active/inactive status, delete models.

---

## 🛠️ Setup & Installation

### 1. Requirements
- Python 3.9+
- MySQL / MariaDB (e.g. XAMPP, phpMyAdmin)
- CUDA-enabled GPU (optional, falls back to CPU automatically)

### 2. Install Dependencies
```bash
pip install -r webapp/requirements.txt
```

### 3. Database Setup
Import `webapp/data/schema.sql` into MySQL, or configure database connection parameters in `webapp/database.py` via environment variables:
- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `3306`)
- `DB_USER` (default: `root`)
- `DB_PASSWORD` (default: ``)
- `DB_NAME` (default: `deepfake_detector`)

### 4. Run the Web Application
```bash
cd webapp
python server.py
```
Open your browser at `http://localhost:5000`.

---

## 🧠 Technologies Used
- **Backend**: Python, Flask, Flask-CORS, PyMySQL
- **AI / Deep Learning**: PyTorch, torchvision, timm (Xception), facenet-pytorch (MTCNN), OpenCV, Pillow
- **Frontend**: HTML5, CSS3 (Modern Flexbox/Grid), Vanilla JavaScript (Async/Await Fetch API)
- **Database**: MySQL / MariaDB
