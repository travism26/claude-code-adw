import { describe, it, before, beforeEach } from 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { testHelper } from '../mocha.setup';
import { notificationService } from '../../services/notificationService';
import { Notification, User } from '../../models';
import { messageBus, MessageBusEvent } from '../../services/messageBus';

use(chaiAsPromised);

describe('NotificationService', () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  describe('sendNotification', () => {
    it('should create a notification in the database', async () => {
      const notification = await notificationService.sendNotification(
        testUser.id,
        'Test notification message'
      );

      expect(notification).to.exist;
      expect(notification.user_id).to.equal(testUser.id);
      expect(notification.message).to.equal('Test notification message');
      expect(notification.type).to.equal('info');
      expect(notification.read).to.equal(false);
    });

    it('should create notification with link and type', async () => {
      const notification = await notificationService.sendNotification(
        testUser.id,
        'Notification with link',
        '/plants/123',
        'success'
      );

      expect(notification.link).to.equal('/plants/123');
      expect(notification.type).to.equal('success');
    });

    it('should publish message bus event', (done) => {
      const unsubscribe = messageBus.subscribe(
        MessageBusEvent.NOTIFICATION_CREATED,
        (payload) => {
          expect(payload.userId).to.equal(testUser.id);
          expect(payload.message).to.equal('Event test message');
          unsubscribe();
          done();
        }
      );

      notificationService.sendNotification(testUser.id, 'Event test message');
    });

    it('should fail with invalid user ID', async () => {
      await expect(
        notificationService.sendNotification(
          '00000000-0000-0000-0000-000000000000',
          'Test message'
        )
      ).rejected;
    });
  });

  describe('getNotifications', () => {
    beforeEach(async () => {
      // Create test notifications
      await Notification.create({
        user_id: testUser.id,
        message: 'Notification 1',
        read: false,
      });

      await Notification.create({
        user_id: testUser.id,
        message: 'Notification 2',
        read: true,
      });

      await Notification.create({
        user_id: testUser.id,
        message: 'Notification 3',
        read: false,
      });
    });

    it('should return all notifications for user', async () => {
      const notifications = await notificationService.getNotifications(testUser.id);

      expect(notifications).to.be.an('array');
      expect(notifications.length).to.be.at.least(3);
    });

    it('should filter unread notifications', async () => {
      const notifications = await notificationService.getNotifications(testUser.id, {
        unreadOnly: true,
      });

      expect(notifications.every(n => !n.read)).to.be.true;
      expect(notifications.length).to.be.at.least(2);
    });

    it('should respect limit parameter', async () => {
      const notifications = await notificationService.getNotifications(testUser.id, {
        limit: 2,
      });

      expect(notifications.length).to.equal(2);
    });
  });

  describe('getNotificationById', () => {
    let notification: Notification;

    beforeEach(async () => {
      notification = await Notification.create({
        user_id: testUser.id,
        message: 'Single notification',
      });
    });

    it('should return notification by ID', async () => {
      const found = await notificationService.getNotificationById(
        notification.id,
        testUser.id
      );

      expect(found).to.exist;
      expect(found?.id).to.equal(notification.id);
    });

    it('should return null for non-existent notification', async () => {
      const found = await notificationService.getNotificationById(
        '00000000-0000-0000-0000-000000000000',
        testUser.id
      );

      expect(found).to.be.null;
    });

    it('should return null when user does not own notification', async () => {
      const otherUser = await testHelper.createTestUser();
      const found = await notificationService.getNotificationById(
        notification.id,
        otherUser.id
      );

      expect(found).to.be.null;
    });
  });

  describe('markAsRead', () => {
    let notification: Notification;

    beforeEach(async () => {
      notification = await Notification.create({
        user_id: testUser.id,
        message: 'Unread notification',
        read: false,
      });
    });

    it('should mark notification as read', async () => {
      const success = await notificationService.markAsRead(
        notification.id,
        testUser.id
      );

      expect(success).to.be.true;

      const updated = await Notification.findByPk(notification.id);
      expect(updated?.read).to.be.true;
    });

    it('should publish message bus event', (done) => {
      const unsubscribe = messageBus.subscribe(
        MessageBusEvent.NOTIFICATION_READ,
        (payload) => {
          expect(payload.notificationId).to.equal(notification.id);
          expect(payload.userId).to.equal(testUser.id);
          unsubscribe();
          done();
        }
      );

      notificationService.markAsRead(notification.id, testUser.id);
    });

    it('should return false for non-existent notification', async () => {
      const success = await notificationService.markAsRead(
        '00000000-0000-0000-0000-000000000000',
        testUser.id
      );

      expect(success).to.be.false;
    });
  });

  describe('markAllAsRead', () => {
    beforeEach(async () => {
      await Notification.create({
        user_id: testUser.id,
        message: 'Unread 1',
        read: false,
      });

      await Notification.create({
        user_id: testUser.id,
        message: 'Unread 2',
        read: false,
      });
    });

    it('should mark all notifications as read', async () => {
      const count = await notificationService.markAllAsRead(testUser.id);

      expect(count).to.be.at.least(2);

      const notifications = await Notification.findAll({
        where: { user_id: testUser.id, read: false },
      });

      expect(notifications.length).to.equal(0);
    });
  });

  describe('deleteNotification', () => {
    let notification: Notification;

    beforeEach(async () => {
      notification = await Notification.create({
        user_id: testUser.id,
        message: 'Notification to delete',
      });
    });

    it('should delete notification', async () => {
      const success = await notificationService.deleteNotification(
        notification.id,
        testUser.id
      );

      expect(success).to.be.true;

      const deleted = await Notification.findByPk(notification.id);
      expect(deleted).to.be.null;
    });

    it('should return false for non-existent notification', async () => {
      const success = await notificationService.deleteNotification(
        '00000000-0000-0000-0000-000000000000',
        testUser.id
      );

      expect(success).to.be.false;
    });
  });

  describe('getUnreadCount', () => {
    beforeEach(async () => {
      await Notification.create({
        user_id: testUser.id,
        message: 'Unread 1',
        read: false,
      });

      await Notification.create({
        user_id: testUser.id,
        message: 'Unread 2',
        read: false,
      });

      await Notification.create({
        user_id: testUser.id,
        message: 'Read 1',
        read: true,
      });
    });

    it('should return correct unread count', async () => {
      const count = await notificationService.getUnreadCount(testUser.id);

      expect(count).to.be.at.least(2);
    });
  });
});
