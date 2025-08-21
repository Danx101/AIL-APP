-- Create notifications table for inbox system
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  studio_id INT NOT NULL,
  type ENUM('google_sheets_import', 'system', 'warning', 'success', 'error') NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSON NULL COMMENT 'Additional notification data',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  INDEX idx_studio_notifications (studio_id, created_at DESC),
  INDEX idx_unread_notifications (studio_id, is_read),
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;