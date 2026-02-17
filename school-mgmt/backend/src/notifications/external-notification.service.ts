import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { Notification, NotificationDocument, NotificationPriority } from './schemas/notification.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ExternalNotificationService {
  private readonly logger = new Logger(ExternalNotificationService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.initEmailTransporter();
  }

  private initEmailTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log('Email transporter initialized');
    } else {
      this.logger.warn('SMTP not configured — email notifications disabled');
    }
  }

  /** Send email notification */
  async sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      const from = this.configService.get<string>('SMTP_FROM', 'noreply@school-mgmt.vn');
      await this.transporter.sendMail({
        from,
        to,
        subject,
        html: htmlBody,
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}:`, err);
      return false;
    }
  }

  /** Send Zalo OA message (placeholder — requires Zalo OA API integration) */
  async sendZaloMessage(phone: string, message: string): Promise<boolean> {
    const zaloToken = this.configService.get<string>('ZALO_OA_TOKEN');
    if (!zaloToken) return false;

    try {
      // Placeholder for Zalo OA API integration
      // In production, use Zalo OA Send Message API:
      // POST https://openapi.zalo.me/v3.0/oa/message/cs
      this.logger.log(`[Zalo] Would send to ${phone}: ${message.substring(0, 50)}...`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send Zalo message to ${phone}:`, err);
      return false;
    }
  }

  /** Send SMS (placeholder — requires SMS gateway integration) */
  async sendSms(phone: string, message: string): Promise<boolean> {
    const smsApiKey = this.configService.get<string>('SMS_API_KEY');
    if (!smsApiKey) return false;

    try {
      // Placeholder for SMS gateway integration (e.g., eSMS, SpeedSMS, Twilio)
      this.logger.log(`[SMS] Would send to ${phone}: ${message.substring(0, 50)}...`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${phone}:`, err);
      return false;
    }
  }

  /** Process pending external notifications — runs every 2 minutes */
  @Cron('*/2 * * * *')
  async processExternalNotifications() {
    try {
      // Find HIGH/URGENT priority notifications that haven't been sent externally yet
      const pendingNotifs = await this.notificationModel
        .find({
          priority: { $in: [NotificationPriority.HIGH, NotificationPriority.URGENT] },
          emailSent: { $ne: true },
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // last 24h only
        })
        .limit(50)
        .lean();

      for (const notif of pendingNotifs) {
        const user = await this.userModel.findById(notif.recipientId).lean();
        if (!user) continue;

        const updates: any = {};

        // Send email if user opted in
        if (user.enableEmailNotif && user.email) {
          const html = this.buildEmailHtml(notif.title, notif.message, notif.link);
          const sent = await this.sendEmail(user.email, `[Thông báo] ${notif.title}`, html);
          if (sent) updates.emailSent = true;
        }

        // Send Zalo if user opted in
        if (user.enableZaloNotif && user.phone) {
          const sent = await this.sendZaloMessage(user.phone, `${notif.title}: ${notif.message}`);
          if (sent) updates.zaloSent = true;
        }

        // Send SMS if user opted in
        if (user.enableSmsNotif && user.phone) {
          const sent = await this.sendSms(user.phone, `${notif.title}: ${notif.message}`);
          if (sent) updates.smsSent = true;
        }

        // Mark as processed (even if no channels configured, mark emailSent to avoid re-processing)
        if (Object.keys(updates).length === 0) {
          updates.emailSent = true; // prevent re-processing
        }

        await this.notificationModel.updateOne(
          { _id: notif._id },
          { $set: updates },
        );
      }

      if (pendingNotifs.length > 0) {
        this.logger.log(`Processed ${pendingNotifs.length} external notifications`);
      }
    } catch (err) {
      this.logger.error('Error processing external notifications:', err);
    }
  }

  /** Build HTML email template */
  private buildEmailHtml(title: string, message: string, link?: string): string {
    const linkHtml = link
      ? `<p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;">Xem chi tiết</a></p>`
      : '';

    return `
      <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#0f172a;color:#e2e8f0;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;color:#f97316;">School Management System</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
          <h3 style="color:#0f172a;margin-top:0;">${title}</h3>
          <p style="color:#475569;line-height:1.6;">${message}</p>
          ${linkHtml}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="color:#94a3b8;font-size:12px;">
            Đây là email tự động, vui lòng không reply.
          </p>
        </div>
      </div>
    `;
  }
}
