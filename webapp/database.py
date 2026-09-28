"""
MySQL-based storage for admin system and deepfake detection logs.
Connects to local MySQL database (e.g. phpMyAdmin / XAMPP / MariaDB).
Tables:
- admins: Admin user accounts
- models: AI model registry
- detection_logs: Detection history records
"""
import os
from datetime import datetime, timedelta
import pymysql
import pymysql.cursors

# Database Configuration (supports environment variables or local defaults)
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", 3306)),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", ""),
    "database": os.environ.get("DB_NAME", "deepfake_detector"),
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
    "autocommit": True
}


def get_connection():
    """Create and return a new MySQL database connection."""
    return pymysql.connect(**DB_CONFIG)


# ─── Initialization ──────────────────────────────────────────────────

def init_db():
    """Ensure required tables exist and populate default data if empty."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Table: admins
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS `admins` (
                        `id` INT AUTO_INCREMENT PRIMARY KEY,
                        `username` VARCHAR(50) NOT NULL UNIQUE,
                        `password` VARCHAR(255) NOT NULL,
                        `role` VARCHAR(20) DEFAULT 'admin',
                        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)

                # 2. Table: models
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS `models` (
                        `id` INT AUTO_INCREMENT PRIMARY KEY,
                        `key` VARCHAR(50) NOT NULL UNIQUE,
                        `name` VARCHAR(100) NOT NULL,
                        `filename` VARCHAR(255) NOT NULL,
                        `description` TEXT,
                        `is_active` TINYINT(1) DEFAULT 1,
                        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)

                # 3. Table: detection_logs
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS `detection_logs` (
                        `id` INT AUTO_INCREMENT PRIMARY KEY,
                        `filename` VARCHAR(255) NOT NULL,
                        `is_fake` TINYINT(1) NOT NULL,
                        `verdict` VARCHAR(50) NOT NULL,
                        `confidence` FLOAT NOT NULL,
                        `real_pct` FLOAT NOT NULL,
                        `fake_pct` FLOAT NOT NULL,
                        `duration` VARCHAR(20),
                        `resolution` VARCHAR(20),
                        `analyzed_frames` INT DEFAULT 0,
                        `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)

                # Insert default admin if none exists
                cur.execute("SELECT COUNT(*) AS count FROM `admins`")
                if cur.fetchone()["count"] == 0:
                    cur.execute("""
                        INSERT INTO `admins` (`username`, `password`, `role`)
                        VALUES ('admin', '123456', 'admin')
                    """)

                # Insert default models if none exist
                cur.execute("SELECT COUNT(*) AS count FROM `models`")
                if cur.fetchone()["count"] == 0:
                    cur.execute("""
                        INSERT INTO `models` (`key`, `name`, `filename`, `description`, `is_active`) VALUES
                        ('deepfakes', 'Deepfakes', 'xception_Deepfakes.pth', 'Xception model trained on Deepfakes dataset', 1),
                        ('face2face', 'Face2Face', 'xception_Face2Face.pth', 'Xception model trained on Face2Face dataset', 1),
                        ('faceshifter', 'FaceShifter', 'xception_FaceShifter.pth', 'Xception model trained on FaceShifter dataset', 1),
                        ('neuraltextures', 'NeuralTextures', 'xception_NeuralTextures.pth', 'Xception model trained on NeuralTextures dataset', 1)
                    """)
        print("[DB] MySQL connection and tables initialized successfully.")
    except Exception as e:
        print(f"[DB Error] init_db failed: {e}")


# ─── Admin auth ──────────────────────────────────────────────────────

def verify_admin(username, password):
    """Return True if credentials match."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT `id` FROM `admins` WHERE `username` = %s AND `password` = %s",
                    (username, password)
                )
                return cur.fetchone() is not None
    except Exception as e:
        print(f"[DB Error] verify_admin: {e}")
        return False


# ─── Model management ───────────────────────────────────────────────

def get_all_models():
    """Return list of all registered models."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT `id`, `key`, `name`, `filename`, `description`, `is_active`, `created_at` FROM `models` ORDER BY `id` ASC"
                )
                rows = cur.fetchall()
                for r in rows:
                    r["is_active"] = bool(r["is_active"])
                    if isinstance(r.get("created_at"), datetime):
                        r["created_at"] = r["created_at"].isoformat()
                return rows
    except Exception as e:
        print(f"[DB Error] get_all_models: {e}")
        return []


def get_active_models():
    """Return dict {key: filename} of active models only."""
    models = get_all_models()
    return {m["key"]: m["filename"] for m in models if m.get("is_active", True)}


def get_active_display_names():
    """Return dict {key: display_name} of active models."""
    models = get_all_models()
    return {m["key"]: m["name"] for m in models if m.get("is_active", True)}


def add_model(key, name, filename, description=""):
    """Add a new model entry."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Check duplicate key
                cur.execute("SELECT `id` FROM `models` WHERE `key` = %s", (key,))
                if cur.fetchone():
                    return False, "Model key already exists"

                cur.execute(
                    """INSERT INTO `models` (`key`, `name`, `filename`, `description`, `is_active`, `created_at`)
                       VALUES (%s, %s, %s, %s, 1, NOW())""",
                    (key, name, filename, description)
                )
                return True, "Model added successfully"
    except Exception as e:
        print(f"[DB Error] add_model: {e}")
        return False, str(e)


def delete_model(key):
    """Remove a model entry by key. Returns the deleted model dict or None."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT `id`, `key`, `name`, `filename`, `description`, `is_active`, `created_at` FROM `models` WHERE `key` = %s",
                    (key,)
                )
                target = cur.fetchone()
                if not target:
                    return None

                cur.execute("DELETE FROM `models` WHERE `key` = %s", (key,))
                target["is_active"] = bool(target["is_active"])
                if isinstance(target.get("created_at"), datetime):
                    target["created_at"] = target["created_at"].isoformat()
                return target
    except Exception as e:
        print(f"[DB Error] delete_model: {e}")
        return None


def toggle_model(key):
    """Toggle is_active for a model. Returns new state (bool) or None if not found."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT `is_active` FROM `models` WHERE `key` = %s", (key,))
                row = cur.fetchone()
                if not row:
                    return None
                new_state = 0 if row["is_active"] else 1
                cur.execute("UPDATE `models` SET `is_active` = %s WHERE `key` = %s", (new_state, key))
                return bool(new_state)
    except Exception as e:
        print(f"[DB Error] toggle_model: {e}")
        return None


# ─── Detection stats / logs ─────────────────────────────────────────

def log_detection(filename, is_fake, confidence, real_pct, fake_pct,
                  duration="", resolution="", analyzed_frames=0, thumbnail_url=""):
    """Record a detection result into detection_logs table."""
    try:
        verdict = "DEEPFAKE DETECTED" if is_fake else "REAL VIDEO"
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO `detection_logs` 
                       (`filename`, `is_fake`, `verdict`, `confidence`, `real_pct`, `fake_pct`, `duration`, `resolution`, `analyzed_frames`, `timestamp`)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
                    (
                        filename,
                        1 if is_fake else 0,
                        verdict,
                        round(float(confidence), 1),
                        round(float(real_pct), 1),
                        round(float(fake_pct), 1),
                        duration,
                        resolution,
                        analyzed_frames
                    )
                )
    except Exception as e:
        print(f"[DB Error] log_detection: {e}")


def get_system_stats():
    """Return summary statistics calculated dynamically from MySQL."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Total and fake counts
                cur.execute("""
                    SELECT 
                        COUNT(*) AS total,
                        COALESCE(SUM(CASE WHEN `is_fake` = 1 THEN 1 ELSE 0 END), 0) AS total_fake
                    FROM `detection_logs`
                """)
                stats_row = cur.fetchone() or {"total": 0, "total_fake": 0}
                total = int(stats_row["total"] or 0)
                total_fake = int(stats_row["total_fake"] or 0)
                total_real = total - total_fake

                real_pct = round((total_real / total) * 100, 1) if total > 0 else 0.0
                fake_pct = round((total_fake / total) * 100, 1) if total > 0 else 0.0

                # 2. Recent 7 days trend
                cur.execute("""
                    SELECT 
                        DATE(`timestamp`) AS log_date,
                        COUNT(*) AS uploads,
                        SUM(CASE WHEN `is_fake` = 0 THEN 1 ELSE 0 END) AS `real`,
                        SUM(CASE WHEN `is_fake` = 1 THEN 1 ELSE 0 END) AS `fake`
                    FROM `detection_logs`
                    WHERE `timestamp` >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                    GROUP BY DATE(`timestamp`)
                """)
                daily_rows = {str(r["log_date"]): r for r in cur.fetchall()}

                trend = []
                for i in range(6, -1, -1):
                    day = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
                    day_data = daily_rows.get(day, {})
                    trend.append({
                        "date": day,
                        "uploads": int(day_data.get("uploads") or 0),
                        "real": int(day_data.get("real") or 0),
                        "fake": int(day_data.get("fake") or 0)
                    })

                # 3. Active models count
                cur.execute("SELECT COUNT(*) AS active_count FROM `models` WHERE `is_active` = 1")
                active_row = cur.fetchone()
                active_models = int(active_row["active_count"] if active_row else 0)

                return {
                    "total_uploads": total,
                    "total_real": total_real,
                    "total_fake": total_fake,
                    "real_pct": real_pct,
                    "fake_pct": fake_pct,
                    "active_models": active_models,
                    "daily_trend": trend
                }
    except Exception as e:
        print(f"[DB Error] get_system_stats: {e}")
        return {
            "total_uploads": 0,
            "total_real": 0,
            "total_fake": 0,
            "real_pct": 0.0,
            "fake_pct": 0.0,
            "active_models": 0,
            "daily_trend": []
        }


def get_detection_history(limit=50):
    """Return recent detection log entries."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT `id`, `filename`, `is_fake`, `verdict`, `confidence`, `real_pct`, `fake_pct`,
                           `duration`, `resolution`, `analyzed_frames`, `timestamp`
                    FROM `detection_logs`
                    ORDER BY `id` DESC
                    LIMIT %s
                """, (limit,))
                rows = cur.fetchall()
                for r in rows:
                    r["is_fake"] = bool(r["is_fake"])
                    r["confidence"] = round(float(r["confidence"]), 1)
                    r["real_pct"] = round(float(r["real_pct"]), 1)
                    r["fake_pct"] = round(float(r["fake_pct"]), 1)
                    if isinstance(r.get("timestamp"), datetime):
                        r["timestamp"] = r["timestamp"].isoformat()
                return rows
    except Exception as e:
        print(f"[DB Error] get_detection_history: {e}")
        return []

