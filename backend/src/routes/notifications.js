const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

// All notification routes require authentication
router.use(authenticate);

// Get notifications for a studio
router.get('/studio/:studioId', notificationController.getStudioNotifications);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all notifications as read for a studio
router.put('/studio/:studioId/read-all', notificationController.markAllAsRead);

// Get unread count for current user
router.get('/unread-count', notificationController.getUnreadCount);

// Clear all notifications for a studio
router.delete('/studio/:studioId/clear', notificationController.clearStudioNotifications);

module.exports = router;