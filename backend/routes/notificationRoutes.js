const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/requireAuth');

// Get user notifications with pagination
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.userId;
    
    console.log(`📋 Loading notifications for user ${userId}`);
    
    let query = `
      SELECT id, user_id, type, title, message, data, is_read, read_at, created_at
      FROM notifications 
      WHERE user_id = $1
    `;
    let params = [userId];
    
    if (type) {
      query += ` AND type = $${params.length + 1}`;
      params.push(type);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);
    
    const notifications = await db.query(query, params);
    
    // Get unread count
    const unreadCountQuery = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    
    res.json({
      notifications: notifications.rows,
      unreadCount: parseInt(unreadCountQuery.rows[0].count || 0),
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: notifications.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;
    
    await db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
    
    // Emit socket event if socket is available
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('notification_marked_read', { notificationId });
    }
    
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW() 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    
    res.json({ unreadCount: parseInt(result.rows[0].count || 0) });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Delete notification
router.delete('/:notificationId', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;
    
    await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Get notification settings (placeholder)
router.get('/settings', auth, async (req, res) => {
  try {
    // Return default settings since we don't have a settings table yet
    res.json({
      weekly_reports_enabled: true,
      monthly_reports_enabled: true,
      quarterly_reports_enabled: true,
      yearly_reports_enabled: true,
      in_app_notifications: true,
      email_notifications: true
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({ error: 'Failed to get notification settings' });
  }
});

// Update notification settings (placeholder)
router.put('/settings', auth, async (req, res) => {
  try {
    // Placeholder for settings update - you can implement this later
    console.log(`Updating notification settings for user ${req.user.userId}:`, req.body);
    res.json({ success: true, message: 'Notification settings updated' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

module.exports = router;
