const SubscriptionService = require('../services/subscriptionService');
const Subscription = require('../models/Subscription');

/**
 * Middleware to require active subscription for studio owners
 * Allows trial users and active subscribers
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    // Skip for non-studio owners
    if (!req.user || req.user.role !== 'studio_owner') {
      return next();
    }

    const validation = await SubscriptionService.validateSubscriptionAccess(req.user.userId);

    if (!validation.valid) {
      return res.status(402).json({
        error: 'Subscription required',
        message: validation.reason,
        code: validation.code,
        subscription_status: {
          valid: false,
          expired_at: validation.expired_at
        }
      });
    }

    // Add subscription info to request for use in controllers
    req.subscription = {
      valid: true,
      type: validation.subscription_type,
      expires_at: validation.expires_at,
      in_grace_period: validation.in_grace_period || false
    };

    next();
  } catch (error) {
    console.error('Subscription middleware error:', error);
    res.status(500).json({
      error: 'Subscription validation failed',
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to check studio creation limits
 * Used specifically for studio creation endpoints
 */
const checkStudioLimit = async (req, res, next) => {
  try {
    // Skip for non-studio owners
    if (!req.user || req.user.role !== 'studio_owner') {
      return next();
    }

    const limitCheck = await SubscriptionService.canCreateStudio(req.user.userId);

    if (!limitCheck.can_create_studio) {
      // Suggest upgrade if at studio limit
      if (limitCheck.reason === 'Studio limit reached') {
        const upgrade = await SubscriptionService.suggestPlanUpgrade(
          req.user.userId, 
          limitCheck.current_studios + 1
        );

        return res.status(402).json({
          error: 'Studio limit reached',
          message: `You can only create ${limitCheck.max_studios_allowed} studio(s) with your current plan`,
          current_studios: limitCheck.current_studios,
          max_studios_allowed: limitCheck.max_studios_allowed,
          upgrade_suggestion: upgrade,
          action_required: 'upgrade_plan'
        });
      }

      return res.status(402).json({
        error: 'Cannot create studio',
        message: limitCheck.reason,
        subscription_active: limitCheck.subscription_active,
        action_required: limitCheck.subscription_active ? 'upgrade_plan' : 'activate_subscription'
      });
    }

    // Add studio limit info to request
    req.studioLimits = {
      current_studios: limitCheck.current_studios,
      max_studios_allowed: limitCheck.max_studios_allowed,
      can_create_more: true
    };

    next();
  } catch (error) {
    console.error('Studio limit middleware error:', error);
    res.status(500).json({
      error: 'Studio limit check failed',
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to add subscription status to response
 * Optional middleware that enriches response with subscription info
 */
const addSubscriptionStatus = async (req, res, next) => {
  try {
    // Skip for non-studio owners
    if (!req.user || req.user.role !== 'studio_owner') {
      return next();
    }

    const status = await SubscriptionService.getSubscriptionStatus(req.user.userId);
    
    // Add to request for controllers to use
    req.subscriptionStatus = status;

    // Patch res.json to include subscription status
    const originalJson = res.json;
    res.json = function(data) {
      if (data && typeof data === 'object' && !data.subscription_status) {
        data.subscription_status = {
          has_subscription: status.has_subscription,
          status: status.subscription?.status,
          is_trial: status.is_trial,
          trial_active: status.trial_active,
          days_remaining: status.days_remaining,
          needs_payment: status.needs_payment,
          max_studios_allowed: status.max_studios_allowed,
          current_studios: status.current_studios
        };
      }
      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    console.error('Subscription status middleware error:', error);
    // Don't fail the request, just continue without subscription status
    next();
  }
};

/**
 * Middleware to require trial or better subscription
 * More lenient than requireActiveSubscription - allows expired trials within grace period
 */
const requireTrialOrBetter = async (req, res, next) => {
  try {
    // Skip for non-studio owners
    if (!req.user || req.user.role !== 'studio_owner') {
      return next();
    }

    const subscription = await Subscription.findByUserId(req.user.userId);
    
    if (!subscription) {
      return res.status(402).json({
        error: 'No subscription found',
        message: 'Please contact support to activate your account',
        action_required: 'contact_support'
      });
    }

    // Allow any subscription status except completely expired
    if (subscription.status === 'cancelled') {
      return res.status(402).json({
        error: 'Subscription cancelled',
        message: 'Your subscription has been cancelled',
        action_required: 'reactivate_subscription'
      });
    }

    req.subscription = {
      id: subscription.id,
      status: subscription.status,
      plan_type: subscription.plan_type,
      max_studios_allowed: subscription.max_studios_allowed
    };

    next();
  } catch (error) {
    console.error('Trial subscription middleware error:', error);
    res.status(500).json({
      error: 'Subscription check failed',
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to warn about upcoming trial expiration
 * Adds warning headers for trial users approaching expiration
 */
const trialExpirationWarning = async (req, res, next) => {
  try {
    // Skip for non-studio owners
    if (!req.user || req.user.role !== 'studio_owner') {
      return next();
    }

    const status = await SubscriptionService.getSubscriptionStatus(req.user.userId);
    
    if (status.is_trial && status.trial_active) {
      if (status.days_remaining <= 7) {
        res.set('X-Trial-Warning', 'true');
        res.set('X-Trial-Days-Remaining', status.days_remaining.toString());
        
        if (status.days_remaining <= 3) {
          res.set('X-Trial-Urgent', 'true');
        }
      }
    }

    next();
  } catch (error) {
    console.error('Trial warning middleware error:', error);
    // Don't fail the request, just continue without warnings
    next();
  }
};

/**
 * Manager-only middleware to access subscription management
 */
const requireManagerForSubscriptions = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'manager') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Manager access required for subscription management'
      });
    }
    next();
  } catch (error) {
    console.error('Manager subscription middleware error:', error);
    res.status(500).json({
      error: 'Authorization check failed',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  requireActiveSubscription,
  checkStudioLimit,
  addSubscriptionStatus,
  requireTrialOrBetter,
  trialExpirationWarning,
  requireManagerForSubscriptions
};