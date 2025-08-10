const db = require('../db');
const { format } = require('date-fns');

class NotificationService {
  // Create a basic notification
  static async createNotification(userId, type, title, message, data = null) {
    try {
      // Check if notifications table exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'notifications'
        )
      `);

      if (!tableExists.rows[0].exists) {
        console.log(`📱 Notifications table doesn't exist - skipping notification for user ${userId}`);
        return null;
      }

      const result = await db.query(
        `INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, false, NOW())
         RETURNING *`,
        [userId, type, title, message, JSON.stringify(data)]
      );
      
      console.log(`📱 Notification created for user ${userId}: ${title}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating notification:', error);
      // Don't throw error - just log it so reports can continue
      return null;
    }
  }

  // 🆕 MAIN METHOD - Create report notification with proper formatting
  static async createReportNotification(userId, reportType, reportDetails) {
    try {
      const titles = {
        'weekly': '📅 Weekly Report Ready!',
        'monthly': '📊 Monthly Report Ready!',
        'quarterly': '📈 Quarterly Report Ready!',
        'yearly': '🗓️ Yearly Report Ready!'
      };

      const messages = {
        'weekly': `Your weekly financial summary for ${reportDetails.period || 'this week'} is available with detailed spending insights.`,
        'monthly': `Your monthly financial report for ${reportDetails.period || 'this month'} is ready with comprehensive analytics.`,
        'quarterly': `Your quarterly analysis for ${reportDetails.period || 'this quarter'} is complete with trend insights and pattern analysis.`,
        'yearly': `Your yearly financial report for ${reportDetails.period || 'this year'} is ready with complete analytics and strategic insights.`
      };

      const title = titles[reportType] || '📋 Report Ready!';
      const message = messages[reportType] || 'Your financial report is ready to view.';

      // Enhanced notification data with routing information
      const notificationData = {
        ...reportDetails,
        reportType: reportType,
        timestamp: new Date().toISOString(),
        routeUrl: this.getReportRouteUrl(reportType),
        actionText: `View ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        icon: this.getReportIcon(reportType)
      };

      // Create notification in database
      const notification = await this.createNotification(
        userId, 
        `${reportType}_report_ready`, 
        title, 
        message, 
        notificationData
      );

      // Send real-time notification via Socket.IO if available
      await this.sendRealTimeNotification(userId, notification);

      console.log(`📱 ${reportType} report notification created for user ${userId}`);
      return notification;
    } catch (error) {
      console.error(`Error creating ${reportType} report notification:`, error);
      // Don't throw error - let report generation continue
      return null;
    }
  }

  // Get appropriate route URL for report type
  static getReportRouteUrl(reportType) {
    const routes = {
      'weekly': '/reports/custom-report',
      'monthly': '/reports/monthly-report',
      'quarterly': '/reports/quarterly-report',
      'yearly': '/reports/yearly-report'
    };
    return routes[reportType] || '/reports';
  }

  // Get appropriate icon for report type
  static getReportIcon(reportType) {
    const icons = {
      'weekly': '📅',
      'monthly': '📊',
      'quarterly': '📈',
      'yearly': '🗓️'
    };
    return icons[reportType] || '📋';
  }

  // Send real-time notification via Socket.IO
  static async sendRealTimeNotification(userId, notification) {
    try {
      // Try to get socket.io from server
      const serverModule = require('../server');
      const io = serverModule.app?.get('io');
      
      if (io && notification) {
        const realtimeData = {
          id: notification.id,
          user_id: notification.user_id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: JSON.parse(notification.data || '{}'),
          is_read: notification.is_read,
          read_at: notification.read_at,
          created_at: notification.created_at
        };

        io.to(`user_${userId}`).emit('new_notification', realtimeData);
        console.log(`📱 Real-time notification sent to user ${userId}`);
      }
    } catch (error) {
      console.warn('📱 Socket.IO not available for real-time notification:', error.message);
    }
  }

  // Create notification for all users
  static async createNotificationForAllUsers(type, title, message, data = null) {
    try {
      const users = await db.query('SELECT id FROM users WHERE is_verified = true');
      const notifications = [];
      
      for (const user of users.rows) {
        const notification = await this.createNotification(user.id, type, title, message, data);
        if (notification) {
          notifications.push(notification);
        }
      }
      
      console.log(`📱 Created ${notifications.length} notifications for all users`);
      return notifications;
    } catch (error) {
      console.error('Error creating notifications for all users:', error);
      return [];
    }
  }

  // Create and emit notification (convenience method)
  static async createAndEmitNotification(io, userId, type, title, message, data = null) {
    try {
      const notification = await this.createNotification(userId, type, title, message, data);
      if (notification && io) {
        this.emitNotification(io, userId, notification);
      }
      return notification;
    } catch (error) {
      console.error('Error creating and emitting notification:', error);
      return null;
    }
  }

  // Direct emit notification
  static emitNotification(io, userId, notification) {
    try {
      if (io && notification) {
        io.to(`user_${userId}`).emit('new_notification', notification);
        console.log(`📱 Direct notification emitted to user ${userId}`);
      }
    } catch (error) {
      console.warn('Error emitting notification:', error.message);
    }
  }

  // Get user notifications
  static async getUserNotifications(userId, limit = 20, offset = 0) {
    try {
      const result = await db.query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    try {
      await db.query(
        `UPDATE notifications 
         SET is_read = true, read_at = NOW() 
         WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );
      console.log(`📱 Notification ${notificationId} marked as read for user ${userId}`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get unread count
  static async getUnreadCount(userId) {
    try {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE user_id = $1 AND is_read = false`,
        [userId]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId) {
    try {
      await db.query(
        `UPDATE notifications 
         SET is_read = true, read_at = NOW() 
         WHERE user_id = $1 AND is_read = false`,
        [userId]
      );
      console.log(`📱 All notifications marked as read for user ${userId}`);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId, userId) {
    try {
      await db.query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );
      console.log(`📱 Notification ${notificationId} deleted for user ${userId}`);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Clean up old notifications
  static async cleanupOldNotifications(daysOld = 30) {
    try {
      const result = await db.query(
        'DELETE FROM notifications WHERE created_at < NOW() - INTERVAL $1 DAY',
        [daysOld]
      );
      console.log(`🗑️ Cleaned up ${result.rowCount || 0} old notifications`);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      return 0;
    }
  }
}

module.exports = NotificationService;
