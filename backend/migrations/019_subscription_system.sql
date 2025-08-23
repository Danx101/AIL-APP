-- Migration 019: Subscription System Implementation
-- Date: 2025-08-21
-- Description: Add subscription management with trials, promocodes, and payment tracking

-- ============================================
-- PHASE 1: Subscriptions Table
-- ============================================

CREATE TABLE subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE COMMENT 'One subscription per studio owner',
  plan_type ENUM('trial', 'single_studio', 'dual_studio', 'triple_studio') NOT NULL DEFAULT 'trial',
  status ENUM('active', 'trial', 'expired', 'cancelled', 'payment_failed') DEFAULT 'trial',
  
  -- Trial management
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  
  -- Subscription periods
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  
  -- Plan limits
  max_studios_allowed INT DEFAULT 1,
  
  -- Stripe integration
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys and indexes
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_subscription (user_id),
  INDEX idx_stripe_customer (stripe_customer_id),
  INDEX idx_subscription_status (status),
  INDEX idx_trial_expiry (trial_ends_at),
  INDEX idx_period_end (current_period_end)
);

-- ============================================
-- PHASE 2: Promocodes Table
-- ============================================

CREATE TABLE promocodes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  created_by_manager_id INT NOT NULL COMMENT 'Manager who created this code',
  
  -- Promocode settings
  extension_months INT DEFAULT 2 COMMENT 'Months to add to trial',
  max_uses INT DEFAULT 1 COMMENT 'How many times code can be used',
  used_count INT DEFAULT 0 COMMENT 'Times code has been used',
  
  -- Expiry and status
  expires_at DATETIME NULL COMMENT 'When code expires (NULL = never)',
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  description TEXT NULL COMMENT 'Optional description for managers',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys and indexes
  FOREIGN KEY (created_by_manager_id) REFERENCES users(id),
  INDEX idx_promocode_lookup (code, is_active),
  INDEX idx_manager_codes (created_by_manager_id),
  INDEX idx_active_codes (is_active, expires_at)
);

-- ============================================
-- PHASE 3: Promocode Usage Tracking
-- ============================================

CREATE TABLE promocode_usage (
  id INT PRIMARY KEY AUTO_INCREMENT,
  promocode_id INT NOT NULL,
  user_id INT NOT NULL,
  subscription_id INT NOT NULL,
  
  -- Usage details
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  months_added INT NOT NULL COMMENT 'Months added to users trial',
  previous_trial_end DATETIME NULL COMMENT 'Trial end before extension',
  new_trial_end DATETIME NOT NULL COMMENT 'Trial end after extension',
  
  -- Foreign keys and indexes
  FOREIGN KEY (promocode_id) REFERENCES promocodes(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  INDEX idx_user_usage (user_id),
  INDEX idx_promocode_usage (promocode_id)
);

-- ============================================
-- PHASE 4: Payment History Tracking
-- ============================================

CREATE TABLE subscription_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subscription_id INT NOT NULL,
  
  -- Stripe payment details
  stripe_payment_intent_id VARCHAR(255) NULL,
  stripe_invoice_id VARCHAR(255) NULL,
  
  -- Payment information
  amount_cents INT NOT NULL COMMENT 'Amount in cents (EUR)',
  currency VARCHAR(3) DEFAULT 'EUR',
  status ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded') NOT NULL,
  
  -- Period covered by this payment
  period_start DATETIME NULL,
  period_end DATETIME NULL,
  
  -- Metadata
  payment_date DATETIME NULL,
  failure_reason TEXT NULL COMMENT 'Reason if payment failed',
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys and indexes
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  INDEX idx_subscription_payments (subscription_id),
  INDEX idx_stripe_payment (stripe_payment_intent_id),
  INDEX idx_payment_status (status),
  INDEX idx_payment_date (payment_date)
);

-- ============================================
-- PHASE 5: Update Existing Tables
-- ============================================

-- Add subscription notification preferences to users
ALTER TABLE users 
ADD COLUMN subscription_notifications_enabled BOOLEAN DEFAULT TRUE 
AFTER email_verified;

-- Add subscription verification timestamp to studios
ALTER TABLE studios 
ADD COLUMN subscription_verified_at DATETIME NULL 
AFTER is_active,
ADD INDEX idx_subscription_check (owner_id, is_active);

-- ============================================
-- PHASE 6: Create Helper Views
-- ============================================

-- View for subscription overview (managers)
CREATE OR REPLACE VIEW subscription_overview AS
SELECT 
    s.id as subscription_id,
    s.user_id,
    u.email,
    u.first_name,
    u.last_name,
    s.plan_type,
    s.status,
    s.trial_ends_at,
    s.current_period_end,
    s.max_studios_allowed,
    
    -- Count actual studios
    COALESCE(studio_count.count, 0) as current_studios,
    
    -- Calculate remaining trial days
    CASE 
        WHEN s.status = 'trial' AND s.trial_ends_at > NOW() 
        THEN DATEDIFF(s.trial_ends_at, NOW())
        ELSE 0
    END as trial_days_remaining,
    
    -- Subscription health
    CASE 
        WHEN s.status = 'trial' AND s.trial_ends_at > NOW() THEN 'trial_active'
        WHEN s.status = 'active' AND s.current_period_end > NOW() THEN 'subscription_active'
        WHEN s.status = 'trial' AND s.trial_ends_at <= NOW() THEN 'trial_expired'
        WHEN s.status = 'active' AND s.current_period_end <= NOW() THEN 'subscription_expired'
        ELSE s.status
    END as health_status,
    
    s.created_at as subscription_created,
    s.updated_at as last_updated
    
FROM subscriptions s
JOIN users u ON s.user_id = u.id
LEFT JOIN (
    SELECT owner_id, COUNT(*) as count 
    FROM studios 
    WHERE is_active = 1 
    GROUP BY owner_id
) studio_count ON s.user_id = studio_count.owner_id
ORDER BY s.created_at DESC;

-- ============================================
-- PHASE 7: Insert Initial Data
-- ============================================

-- Create trial subscriptions for existing studio owners
INSERT INTO subscriptions (user_id, plan_type, status, trial_started_at, trial_ends_at, max_studios_allowed)
SELECT 
    u.id,
    'trial',
    'trial',
    u.created_at,
    DATE_ADD(u.created_at, INTERVAL 30 DAY) as trial_end,
    1
FROM users u
WHERE u.role = 'studio_owner' 
AND u.email_verified = TRUE
AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = u.id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check subscription creation
SELECT 
    'Subscriptions Created' as check_type,
    COUNT(*) as count
FROM subscriptions;

-- Check studio owner trial assignments
SELECT 
    u.email,
    s.status,
    s.trial_ends_at,
    DATEDIFF(s.trial_ends_at, NOW()) as days_remaining
FROM users u
JOIN subscriptions s ON u.id = s.user_id
WHERE u.role = 'studio_owner'
ORDER BY s.trial_ends_at;

-- Summary report
SELECT 
    s.status,
    COUNT(*) as count,
    GROUP_CONCAT(CONCAT(u.first_name, ' ', u.last_name) SEPARATOR ', ') as users
FROM subscriptions s
JOIN users u ON s.user_id = u.id
GROUP BY s.status;

-- ============================================
-- NOTES FOR DEVELOPERS
-- ============================================

/*
USAGE NOTES:

1. TRIAL SYSTEM:
   - New studio owners get 30-day trial automatically
   - Promocodes extend trial by 2 months (stackable)
   - Grace period handled in application logic

2. PLAN TYPES:
   - trial: 30-day free trial (1 studio)
   - single_studio: €29/month (1 studio)  
   - dual_studio: €49/month (2 studios)
   - triple_studio: €69/month (3 studios)

3. STATUS FLOW:
   trial → active (after payment)
   active → payment_failed → expired (after grace period)
   
4. STRIPE INTEGRATION:
   - stripe_customer_id: Links to Stripe customer
   - stripe_subscription_id: Links to Stripe subscription
   - Payment webhooks update subscription_payments table

5. ACCESS CONTROL:
   - Check max_studios_allowed before studio creation
   - Verify trial_ends_at for trial users
   - Check current_period_end for paid users
*/