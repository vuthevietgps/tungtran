import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface ParsedWebhookMessage {
  pageId: string;
  senderId: string;
  senderName?: string;
  messageText: string;
  messageId?: string;
  adRefParam?: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  // ─── Facebook ───────────────────────────────────────────────

  verifyFacebookWebhook(
    query: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string },
    expectedVerifyToken: string,
  ): string | null {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === expectedVerifyToken) {
      this.logger.log('Facebook webhook verified successfully');
      return challenge || null;
    }

    this.logger.warn('Facebook webhook verification failed');
    return null;
  }

  verifyFacebookSignature(rawBody: Buffer, signature: string, appSecret: string): boolean {
    if (!signature || !appSecret) return false;
    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig),
    );
  }

  parseFacebookWebhookPayload(body: any): ParsedWebhookMessage[] {
    const messages: ParsedWebhookMessage[] = [];

    if (body.object !== 'page') return messages;

    for (const entry of body.entry || []) {
      const pageId = entry.id;
      for (const event of entry.messaging || []) {
        if (!event.message?.text) continue;

        let adRefParam: string | undefined;
        if (event.referral?.ref) {
          adRefParam = event.referral.ref;
        } else if (event.referral?.ad_id) {
          adRefParam = event.referral.ad_id;
        } else if (event.postback?.referral?.ad_id) {
          adRefParam = event.postback.referral.ad_id;
        }

        messages.push({
          pageId,
          senderId: event.sender?.id,
          senderName: event.sender?.name,
          messageText: event.message.text,
          messageId: event.message.mid,
          adRefParam,
        });
      }
    }

    return messages;
  }

  // ─── TikTok ─────────────────────────────────────────────────

  verifyTikTokSignature(rawBody: Buffer, signature: string, appSecret: string): boolean {
    if (!signature || !appSecret) return false;
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig),
    );
  }

  parseTikTokWebhookPayload(body: any): ParsedWebhookMessage[] {
    const messages: ParsedWebhookMessage[] = [];

    const events = body.data || [];
    for (const event of events) {
      if (event.event !== 'receive_message') continue;
      const content = event.content;
      if (!content?.text) continue;

      messages.push({
        pageId: event.to_user_id || body.page_id || '',
        senderId: event.from_user_id || '',
        messageText: content.text,
        messageId: event.message_id,
        adRefParam: event.ad_id || content.ad_id,
      });
    }

    return messages;
  }
}
