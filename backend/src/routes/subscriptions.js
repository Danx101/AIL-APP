const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { 
  requireActiveSubscription, 
  requireTrialOrBetter,
  requireManagerForSubscriptions 
} = require('../middleware/subscription');
const SubscriptionService = require('../services/subscriptionService');
const Subscription = require('../models/Subscription');
const PromoCode = require('../models/PromoCode');

/**
 * GET /api/v1/subscriptions/status
 * Get current user's subscription status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'studio_owner') {
      return res.json({
        has_subscription: false,
        message: 'Subscriptions are only for studio owners'
      });
    }

    const status = await SubscriptionService.getSubscriptionStatus(req.user.userId);
    res.json(status);
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription status',
      message: 'Internal server error' 
    });
  }
});

/**
 * POST /api/v1/subscriptions/redeem-promocode
 * Redeem a promocode for trial extension
 */
router.post('/redeem-promocode', [
  authenticate,
  body('promocode').notEmpty().withMessage('Promocode is required'),
], async (req, res) => {
  try {
    const { promocode } = req.body;
    const userId = req.user.userId;

    // Only allow studio owners to redeem promocodes
    if (req.user.role !== 'studio_owner') {
      return res.status(403).json({
        success: false,
        message: 'Only studio owners can redeem promocodes'
      });
    }

    const result = await SubscriptionService.redeemPromoCode(promocode, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        code: result.code
      });
    }

    res.json({
      success: true,
      message: result.message,
      months_added: result.months_added,
      previous_trial_end: result.previous_trial_end,
      new_trial_end: result.new_trial_end
    });

  } catch (error) {
    console.error('Error redeeming promocode:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to redeem promocode',
      message: 'Internal server error' 
    });
  }
});

/**
 * GET /api/v1/subscriptions/validate-promocode
 * Validate a promocode without redeeming it
 */
router.get('/validate-promocode', [
  query('code').notEmpty().withMessage('Promocode is required')
], async (req, res) => {
  try {
    const { code } = req.query;

    const validation = await PromoCode.validateForRedemption(code);

    if (!validation.valid) {
      return res.json({
        valid: false,
        message: validation.reason,
        code: validation.code
      });
    }

    res.json({
      valid: true,
      message: 'Promocode is valid',
      extension_months: validation.extension_months,
      promocode: {
        code: validation.promocode.code,
        extension_months: validation.promocode.extension_months,
        description: validation.promocode.description
      }
    });

  } catch (error) {
    console.error('Error validating promocode:', error);
    res.status(500).json({ 
      valid: false,
      message: 'Error validating promocode' 
    });
  }
});

/**
 * GET /api/v1/subscriptions/upgrade-suggestion
 * Get plan upgrade suggestion for desired studio count
 */
router.get('/upgrade-suggestion', [
  authenticate,
  query('desired_studios').isInt({ min: 1, max: 3 }).withMessage('Desired studios must be 1-3')
], async (req, res) => {
  try {
    const { desired_studios } = req.query;
    const userId = req.user.userId;

    if (req.user.role !== 'studio_owner') {
      return res.status(403).json({
        error: 'Only studio owners can get upgrade suggestions'
      });
    }

    const suggestion = await SubscriptionService.suggestPlanUpgrade(
      userId, 
      parseInt(desired_studios)
    );

    res.json(suggestion);

  } catch (error) {
    console.error('Error getting upgrade suggestion:', error);
    res.status(500).json({ 
      error: 'Failed to get upgrade suggestion',
      message: 'Internal server error' 
    });
  }
});

/**
 * GET /api/v1/subscriptions/studio-limits
 * Check current studio creation limits
 */
router.get('/studio-limits', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'studio_owner') {
      return res.json({
        can_create_studio: false,
        reason: 'Only studio owners can create studios',
        current_studios: 0,
        max_studios_allowed: 0,
        subscription_active: false
      });
    }

    const limitCheck = await SubscriptionService.canCreateStudio(req.user.userId);
    res.json(limitCheck);

  } catch (error) {
    console.error('Error checking studio limits:', error);
    res.status(500).json({ 
      can_create_studio: false,
      reason: 'Error checking subscription',
      current_studios: 0,
      max_studios_allowed: 0,
      subscription_active: false
    });
  }
});

// ============================================
// MANAGER-ONLY ROUTES
// ============================================

/**
 * GET /api/v1/subscriptions/overview
 * Get subscription overview for managers
 */
router.get('/overview', [authenticate, requireManagerForSubscriptions], async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    
    const subscriptions = await Subscription.findAll({ 
      limit: parseInt(limit), 
      offset: parseInt(offset),
      status 
    });
    
    const statistics = await Subscription.getStatistics();
    
    res.json({
      subscriptions,
      statistics,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: subscriptions.length
      }
    });

  } catch (error) {
    console.error('Error getting subscription overview:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription overview',
      message: 'Internal server error' 
    });
  }
});

/**
 * POST /api/v1/subscriptions/promocodes/generate
 * Generate new promocodes (managers only)
 */
router.post('/promocodes/generate', [
  authenticate,
  requireManagerForSubscriptions,
  body('count').optional().isInt({ min: 1, max: 100 }).withMessage('Count must be 1-100'),
  body('extension_months').optional().isInt({ min: 1, max: 12 }).withMessage('Extension months must be 1-12'),
  body('max_uses').optional().isInt({ min: 1, max: 1000 }).withMessage('Max uses must be 1-1000'),
  body('expires_in_days').optional().isInt({ min: 1 }).withMessage('Expiry days must be positive'),
  body('description').optional().isLength({ max: 255 }).withMessage('Description too long')
], async (req, res) => {
  try {
    const { 
      count = 1, 
      extension_months = 2, 
      max_uses = 1, 
      expires_in_days, 
      description,
      prefix = 'AIL'
    } = req.body;

    const createdCodes = [];
    const managerId = req.user.userId;

    // Calculate expiry date if specified
    let expiresAt = null;
    if (expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    for (let i = 0; i < count; i++) {
      // Generate unique code
      let code, isUnique = false;
      while (!isUnique) {
        code = PromoCode.generateCode(prefix, 6);
        const existing = await PromoCode.findByCode(code);
        isUnique = !existing;
      }

      const promoCode = await PromoCode.create({
        code,
        created_by_manager_id: managerId,
        extension_months,
        max_uses,
        expires_at: expiresAt?.toISOString(),
        description
      });

      createdCodes.push(promoCode);
    }

    res.status(201).json({
      message: `Generated ${count} promocode(s) successfully`,
      promocodes: createdCodes,
      summary: {
        count: createdCodes.length,
        extension_months,
        max_uses,
        expires_at: expiresAt?.toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating promocodes:', error);
    res.status(500).json({ 
      error: 'Failed to generate promocodes',
      message: 'Internal server error' 
    });
  }
});

/**
 * GET /api/v1/subscriptions/promocodes
 * Get promocodes created by current manager
 */
router.get('/promocodes', [authenticate, requireManagerForSubscriptions], async (req, res) => {
  try {
    const { limit = 50, offset = 0, active_only = false } = req.query;
    const managerId = req.user.userId;

    const promocodes = await PromoCode.findByManager(managerId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      active_only: active_only === 'true'
    });

    const statistics = await PromoCode.getStatistics(managerId);

    res.json({
      promocodes,
      statistics,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: promocodes.length
      }
    });

  } catch (error) {
    console.error('Error getting promocodes:', error);
    res.status(500).json({ 
      error: 'Failed to get promocodes',
      message: 'Internal server error' 
    });
  }
});

/**
 * GET /api/v1/subscriptions/promocodes/:id/usage
 * Get usage history for a specific promocode
 */
router.get('/promocodes/:id/usage', [authenticate, requireManagerForSubscriptions], async (req, res) => {
  try {
    const { id } = req.params;
    const managerId = req.user.userId;

    // Verify the promocode belongs to this manager
    const promocode = await PromoCode.findByCode(id);
    if (!promocode) {
      return res.status(404).json({ 
        error: 'Promocode not found' 
      });
    }

    if (promocode.created_by_manager_id !== managerId) {
      return res.status(403).json({ 
        error: 'Access denied - not your promocode' 
      });
    }

    const usageHistory = await PromoCode.getUsageHistory(promocode.id);

    res.json({
      promocode: {
        code: promocode.code,
        extension_months: promocode.extension_months,
        max_uses: promocode.max_uses,
        used_count: promocode.used_count,
        status: promocode.status
      },
      usage_history: usageHistory
    });

  } catch (error) {
    console.error('Error getting promocode usage:', error);
    res.status(500).json({ 
      error: 'Failed to get promocode usage',
      message: 'Internal server error' 
    });
  }
});

/**
 * POST /api/v1/subscriptions/promocodes/:id/deactivate
 * Deactivate a promocode
 */
router.post('/promocodes/:id/deactivate', [authenticate, requireManagerForSubscriptions], async (req, res) => {
  try {
    const { id } = req.params;
    const managerId = req.user.userId;

    const success = await PromoCode.deactivate(id, managerId);

    if (!success) {
      return res.status(404).json({ 
        error: 'Promocode not found or access denied' 
      });
    }

    res.json({
      message: 'Promocode deactivated successfully',
      deactivated: true
    });

  } catch (error) {
    console.error('Error deactivating promocode:', error);
    res.status(500).json({ 
      error: 'Failed to deactivate promocode',
      message: 'Internal server error' 
    });
  }
});

/**
 * GET /api/v1/subscriptions/statistics
 * Get subscription and conversion statistics for managers
 */
router.get('/statistics', [authenticate, requireManagerForSubscriptions], async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const subscriptionStats = await Subscription.getStatistics();
    const conversionStats = await SubscriptionService.getTrialConversionStats(parseInt(days));
    const promocodeStats = await PromoCode.getStatistics();

    res.json({
      subscription_statistics: subscriptionStats,
      conversion_statistics: conversionStats,
      promocode_statistics: promocodeStats,
      period_days: parseInt(days)
    });

  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({ 
      error: 'Failed to get statistics',
      message: 'Internal server error' 
    });
  }
});

module.exports = router;