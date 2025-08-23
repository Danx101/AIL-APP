const Subscription = require('../models/Subscription');
const PromoCode = require('../models/PromoCode');

class SubscriptionService {
  /**
   * Create a trial subscription for a new studio owner
   * @param {number} userId - User ID
   * @param {number} trialDays - Trial duration in days (default 30)
   * @returns {Promise<Object>} Created subscription
   */
  static async createTrial(userId, trialDays = 30) {
    try {
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + trialDays);

      const subscriptionData = {
        user_id: userId,
        plan_type: 'trial',
        status: 'trial',
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        max_studios_allowed: 1
      };

      const subscription = await Subscription.create(subscriptionData);
      
      return {
        success: true,
        subscription,
        trial_days: trialDays,
        trial_ends_at: trialEnd.toISOString()
      };
    } catch (error) {
      console.error('Error creating trial subscription:', error);
      throw new Error('Failed to create trial subscription');
    }
  }

  /**
   * Redeem a promocode for trial extension
   * @param {string} code - Promocode
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Redemption result
   */
  static async redeemPromoCode(code, userId) {
    try {
      // Get user's subscription
      const subscription = await Subscription.findByUserId(userId);
      if (!subscription) {
        return {
          success: false,
          error: 'No subscription found for user',
          code: 'NO_SUBSCRIPTION'
        };
      }

      // Only allow redemption for trial subscriptions
      if (subscription.status !== 'trial') {
        return {
          success: false,
          error: 'Promocodes can only be used during trial period',
          code: 'NOT_TRIAL'
        };
      }

      // Redeem the promocode
      const redemption = await PromoCode.redeem(code, userId, subscription.id);
      
      if (!redemption.valid) {
        return {
          success: false,
          error: redemption.reason,
          code: redemption.code
        };
      }

      return {
        success: true,
        months_added: redemption.months_added,
        previous_trial_end: redemption.previous_trial_end,
        new_trial_end: redemption.new_trial_end,
        message: `Trial extended by ${redemption.months_added} months`
      };
    } catch (error) {
      console.error('Error redeeming promocode:', error);
      throw new Error('Failed to redeem promocode');
    }
  }

  /**
   * Check if user can create a new studio
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Studio creation eligibility
   */
  static async canCreateStudio(userId) {
    try {
      const limitCheck = await Subscription.checkStudioLimit(userId);
      return limitCheck;
    } catch (error) {
      console.error('Error checking studio limit:', error);
      return {
        can_create_studio: false,
        reason: 'Error checking subscription',
        current_studios: 0,
        max_studios_allowed: 0,
        subscription_active: false
      };
    }
  }

  /**
   * Get subscription status for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Detailed subscription status
   */
  static async getSubscriptionStatus(userId) {
    try {
      const subscription = await Subscription.findByUserId(userId);
      if (!subscription) {
        return {
          has_subscription: false,
          status: 'no_subscription',
          message: 'No subscription found'
        };
      }

      const now = new Date();
      let detailedStatus = {};

      if (subscription.status === 'trial') {
        const trialEnd = new Date(subscription.trial_ends_at);
        const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
        
        detailedStatus = {
          is_trial: true,
          trial_active: daysRemaining > 0,
          days_remaining: Math.max(0, daysRemaining),
          trial_ends_at: subscription.trial_ends_at,
          needs_payment: daysRemaining <= 7, // Show payment prompt in last week
          grace_period: daysRemaining < 0 && daysRemaining >= -7
        };
      } else if (subscription.status === 'active') {
        const periodEnd = new Date(subscription.current_period_end);
        const daysUntilRenewal = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
        
        detailedStatus = {
          is_trial: false,
          subscription_active: daysUntilRenewal > 0,
          days_until_renewal: Math.max(0, daysUntilRenewal),
          current_period_end: subscription.current_period_end,
          auto_renewal: true
        };
      }

      return {
        has_subscription: true,
        subscription,
        ...detailedStatus,
        can_create_studios: subscription.is_active,
        max_studios_allowed: subscription.max_studios_allowed,
        current_studios: subscription.current_studios || 0
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw new Error('Failed to get subscription status');
    }
  }

  /**
   * Suggest plan upgrade based on studio count
   * @param {number} userId - User ID
   * @param {number} desiredStudioCount - Number of studios user wants
   * @returns {Promise<Object>} Upgrade suggestion
   */
  static async suggestPlanUpgrade(userId, desiredStudioCount) {
    try {
      const subscription = await Subscription.findByUserId(userId);
      if (!subscription) {
        return {
          upgrade_needed: true,
          reason: 'No subscription found',
          suggested_plan: 'single_studio'
        };
      }

      let suggestedPlan = 'single_studio';
      let monthlyPrice = 29;

      if (desiredStudioCount >= 3) {
        suggestedPlan = 'triple_studio';
        monthlyPrice = 69;
      } else if (desiredStudioCount >= 2) {
        suggestedPlan = 'dual_studio';
        monthlyPrice = 49;
      }

      const upgradeNeeded = desiredStudioCount > subscription.max_studios_allowed;

      return {
        upgrade_needed: upgradeNeeded,
        current_plan: subscription.plan_type,
        current_limit: subscription.max_studios_allowed,
        suggested_plan: suggestedPlan,
        new_limit: this.getPlanStudioLimit(suggestedPlan),
        monthly_price: monthlyPrice,
        savings_message: this.calculateSavingsMessage(suggestedPlan)
      };
    } catch (error) {
      console.error('Error suggesting plan upgrade:', error);
      throw new Error('Failed to suggest plan upgrade');
    }
  }

  /**
   * Get studio limit for a plan type
   * @param {string} planType - Plan type
   * @returns {number} Studio limit
   */
  static getPlanStudioLimit(planType) {
    const limits = {
      'trial': 1,
      'single_studio': 1,
      'dual_studio': 2,
      'triple_studio': 3
    };
    return limits[planType] || 1;
  }

  /**
   * Calculate savings message for plan
   * @param {string} planType - Plan type
   * @returns {string} Savings message
   */
  static calculateSavingsMessage(planType) {
    const messages = {
      'single_studio': '€29/month per studio',
      'dual_studio': '€24.50/month per studio (Save €9/month vs 2 single plans)',
      'triple_studio': '€23/month per studio (Save €18/month vs 3 single plans)'
    };
    return messages[planType] || '';
  }

  /**
   * Process expired trials (for scheduled job)
   * @param {number} graceDays - Days after expiry to allow (default 7)
   * @returns {Promise<Object>} Processing results
   */
  static async processExpiredTrials(graceDays = 7) {
    try {
      const expiredTrials = await Subscription.findExpiredTrials(graceDays);
      const results = {
        total_expired: expiredTrials.length,
        within_grace: [],
        beyond_grace: [],
        processed: 0
      };

      for (const trial of expiredTrials) {
        if (trial.days_overdue <= graceDays) {
          results.within_grace.push({
            user_id: trial.user_id,
            email: trial.email,
            days_overdue: trial.days_overdue
          });
        } else {
          results.beyond_grace.push({
            user_id: trial.user_id,
            email: trial.email,
            days_overdue: trial.days_overdue
          });
          
          // TODO: Disable studio access for users beyond grace period
          // This would involve deactivating their studios
          results.processed++;
        }
      }

      return results;
    } catch (error) {
      console.error('Error processing expired trials:', error);
      throw new Error('Failed to process expired trials');
    }
  }

  /**
   * Get trial conversion rate statistics
   * @param {number} days - Days to look back (default 30)
   * @returns {Promise<Object>} Conversion statistics
   */
  static async getTrialConversionStats(days = 30) {
    try {
      // This would typically query subscription_payments table
      // For now, return basic statistics from subscriptions
      const stats = await Subscription.getStatistics();
      
      // Calculate conversion rate (active subscriptions / total trials)
      const totalTrials = stats.active_trials + stats.expired_trials;
      const conversionRate = totalTrials > 0 
        ? (stats.active_subscriptions / totalTrials * 100).toFixed(1)
        : 0;

      return {
        total_trials_started: totalTrials,
        active_trials: stats.active_trials,
        converted_to_paid: stats.active_subscriptions,
        conversion_rate: `${conversionRate}%`,
        monthly_revenue: stats.monthly_revenue_eur,
        payment_failures: stats.payment_failed
      };
    } catch (error) {
      console.error('Error getting conversion stats:', error);
      throw new Error('Failed to get conversion statistics');
    }
  }

  /**
   * Validate subscription for API access
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Validation result
   */
  static async validateSubscriptionAccess(userId) {
    try {
      const subscription = await Subscription.findByUserId(userId);
      if (!subscription) {
        return {
          valid: false,
          reason: 'No subscription found',
          code: 'NO_SUBSCRIPTION'
        };
      }

      const now = new Date();

      // Check trial status
      if (subscription.status === 'trial') {
        const trialEnd = new Date(subscription.trial_ends_at);
        const gracePeriodEnd = new Date(trialEnd);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7-day grace period

        if (now <= gracePeriodEnd) {
          return {
            valid: true,
            subscription_type: 'trial',
            expires_at: subscription.trial_ends_at,
            in_grace_period: now > trialEnd
          };
        } else {
          return {
            valid: false,
            reason: 'Trial expired',
            code: 'TRIAL_EXPIRED',
            expired_at: subscription.trial_ends_at
          };
        }
      }

      // Check active subscription
      if (subscription.status === 'active') {
        const periodEnd = new Date(subscription.current_period_end);
        if (now <= periodEnd) {
          return {
            valid: true,
            subscription_type: 'active',
            expires_at: subscription.current_period_end
          };
        } else {
          return {
            valid: false,
            reason: 'Subscription expired',
            code: 'SUBSCRIPTION_EXPIRED',
            expired_at: subscription.current_period_end
          };
        }
      }

      return {
        valid: false,
        reason: `Subscription status: ${subscription.status}`,
        code: 'INVALID_STATUS'
      };
    } catch (error) {
      console.error('Error validating subscription access:', error);
      return {
        valid: false,
        reason: 'Error validating subscription',
        code: 'VALIDATION_ERROR'
      };
    }
  }
}

module.exports = SubscriptionService;