const Notification = require('../models/Notification');
const Studio = require('../models/Studio');

class NotificationController {
  /**
   * Get notifications for a studio
   * GET /api/v1/notifications/studio/:studioId
   */
  async getStudioNotifications(req, res) {
    try {
      const { studioId } = req.params;
      const { page = 1, limit = 20, unread_only = false } = req.query;

      // Authorization check
      const studio = await Studio.findById(studioId);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (req.user.role !== 'admin' && studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const options = {
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        unreadOnly: unread_only === 'true'
      };

      const notifications = await Notification.findByStudio(studioId, options);
      const unreadCount = await Notification.getUnreadCount(studioId);

      res.json({
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: notifications.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Error getting studio notifications:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Mark notification as read
   * PUT /api/v1/notifications/:id/read
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      
      // Get user's studio ID
      let studioId = req.user.studioId;
      
      if (req.user.role === 'admin' || req.user.role === 'studio_owner') {
        const studio = await Studio.findByOwnerId(req.user.userId);
        studioId = studio?.id || studioId;
      }

      if (!studioId) {
        return res.status(400).json({ message: 'Studio not found' });
      }

      // Get notification to check ownership
      const notifications = await Notification.findByStudio(studioId);
      const notification = notifications.find(n => n.id === parseInt(id));

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      // Authorization check
      if (req.user.role !== 'admin') {
        const studio = await Studio.findById(notification.studio_id);
        if (!studio || studio.owner_id !== req.user.userId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      await notification.markAsRead();

      res.json({
        message: 'Notification marked as read',
        notification
      });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Mark all notifications as read for a studio
   * PUT /api/v1/notifications/studio/:studioId/read-all
   */
  async markAllAsRead(req, res) {
    try {
      const { studioId } = req.params;

      // Authorization check
      const studio = await Studio.findById(studioId);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (req.user.role !== 'admin' && studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const db = require('../database/database-wrapper');
      await db.run(`
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW()
        WHERE studio_id = ? AND is_read = FALSE
      `, [studioId]);

      const unreadCount = await Notification.getUnreadCount(studioId);

      res.json({
        message: 'All notifications marked as read',
        unreadCount
      });

    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get unread count for current user's studio
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(req, res) {
    try {
      // Get user's studio
      let studioId = req.user.studioId;
      
      if (req.user.role === 'admin' || req.user.role === 'studio_owner') {
        const studio = await Studio.findByOwnerId(req.user.userId);
        studioId = studio?.id || studioId;
      }

      if (!studioId) {
        return res.json({ unreadCount: 0 });
      }

      const unreadCount = await Notification.getUnreadCount(studioId);

      res.json({ unreadCount });

    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Clear all notifications for a studio
   * DELETE /api/v1/notifications/studio/:studioId/clear
   */
  async clearStudioNotifications(req, res) {
    try {
      const { studioId } = req.params;

      // Authorization check
      const studio = await Studio.findById(studioId);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (req.user.role !== 'admin' && studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const db = require('../database/database-wrapper');
      const result = await db.run(`
        DELETE FROM notifications 
        WHERE studio_id = ?
      `, [studioId]);

      res.json({
        message: 'All notifications cleared',
        deletedCount: result.changes || 0
      });

    } catch (error) {
      console.error('Error clearing notifications:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new NotificationController();