-- ==========================================================
-- Database Schema for AI Deepfake Detection System (MySQL / MariaDB)
-- Database: deepfake_detector
-- ==========================================================

-- 1. Table: admins (ผู้ดูแลระบบ)
CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) DEFAULT 'admin',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: models (โมเดลปัญญาประดิษฐ์)
CREATE TABLE IF NOT EXISTS `models` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: detection_logs (ประวัติการตรวจจับวิดีโอ)
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

-- ==========================================================
-- ข้อมูลเริ่มต้น (Initial Data / Seed Data)
-- ==========================================================

-- ข้อมูล Admin เริ่มต้น (username: admin, password: 123456)
INSERT INTO `admins` (`id`, `username`, `password`, `role`, `created_at`) 
VALUES (1, 'admin', '123456', 'admin', NOW())
ON DUPLICATE KEY UPDATE `username`=`username`;

-- ข้อมูลโมเดลเริ่มต้น 4 โมเดล
INSERT INTO `models` (`id`, `key`, `name`, `filename`, `description`, `is_active`, `created_at`) VALUES
(1, 'deepfakes', 'Deepfakes', 'xception_Deepfakes.pth', 'Xception model trained on Deepfakes dataset', 1, NOW()),
(2, 'face2face', 'Face2Face', 'xception_Face2Face.pth', 'Xception model trained on Face2Face dataset', 1, NOW()),
(3, 'faceshifter', 'FaceShifter', 'xception_FaceShifter.pth', 'Xception model trained on FaceShifter dataset', 1, NOW()),
(4, 'neuraltextures', 'NeuralTextures', 'xception_NeuralTextures.pth', 'Xception model trained on NeuralTextures dataset', 1, NOW())
ON DUPLICATE KEY UPDATE `key`=`key`;

-- ประวัติการวิเคราะห์เดิมจาก JSON (Detection History)
INSERT INTO `detection_logs` (`id`, `filename`, `is_fake`, `verdict`, `confidence`, `real_pct`, `fake_pct`, `duration`, `resolution`, `analyzed_frames`, `timestamp`) VALUES
(1, '000_003.mp4', 1, 'DEEPFAKE DETECTED', 59.7, 40.3, 59.7, '15.8s', '640x480', 12, '2026-09-09 20:44:16'),
(2, '000_003.mp4', 1, 'DEEPFAKE DETECTED', 59.7, 40.3, 59.7, '15.8s', '640x480', 12, '2026-09-09 21:45:53'),
(3, '000_003.mp4', 1, 'DEEPFAKE DETECTED', 59.7, 40.3, 59.7, '15.8s', '640x480', 12, '2026-09-09 21:47:51'),
(4, '000_003.mp4', 1, 'DEEPFAKE DETECTED', 59.7, 40.3, 59.7, '15.8s', '640x480', 12, '2026-09-09 21:48:12'),
(5, '000_003.mp4', 1, 'DEEPFAKE DETECTED', 67.6, 32.4, 67.6, '15.8s', '640x480', 12, '2026-09-09 23:45:01'),
(6, '000.mp4', 0, 'REAL VIDEO', 97.0, 97.0, 3.0, '15.8s', '640x480', 12, '2026-09-10 01:26:42')
ON DUPLICATE KEY UPDATE `id`=`id`;
