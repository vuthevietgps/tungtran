import {
  Controller, Get, Post, Param, Query, Req, Res,
  HttpStatus, Logger, RawBodyRequest,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatbotService } from './chatbot.service';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly webhookService: WebhookService,
  ) {}

  // ─── Facebook Webhook Verification ──────────────────────────

  @Get('facebook/:pageId')
  async verifyFacebook(
    @Param('pageId') pageId: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const fanpage = await this.chatbotService.findFanpageByPageId(pageId);
    if (!fanpage || !fanpage.webhookVerifyToken) {
      return res.status(HttpStatus.FORBIDDEN).send('Fanpage not found');
    }

    const challenge = this.webhookService.verifyFacebookWebhook(query, fanpage.webhookVerifyToken);
    if (challenge) {
      return res.status(HttpStatus.OK).send(challenge);
    }
    return res.status(HttpStatus.FORBIDDEN).send('Verification failed');
  }

  // ─── Facebook Incoming Messages ─────────────────────────────

  @Post('facebook/:pageId')
  async handleFacebook(
    @Param('pageId') pageId: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    // Always respond 200 quickly to prevent Facebook retries
    res.status(HttpStatus.OK).send('EVENT_RECEIVED');

    try {
      const fanpage = await this.chatbotService.findFanpageByPageId(pageId);
      if (!fanpage) {
        this.logger.warn(`Facebook webhook: fanpage not found for pageId ${pageId}`);
        return;
      }

      // Verify signature if appSecret is configured
      const signature = req.headers['x-hub-signature-256'] as string;
      if (fanpage.appSecret && signature) {
        const appSecret = this.chatbotService.getDecryptedAppSecret(fanpage);
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        if (!this.webhookService.verifyFacebookSignature(rawBody, signature, appSecret)) {
          this.logger.warn(`Facebook webhook: signature verification failed for pageId ${pageId}`);
          return;
        }
      }

      const messages = this.webhookService.parseFacebookWebhookPayload(req.body);
      for (const msg of messages) {
        await this.chatbotService.handleIncomingCustomerMessage(
          fanpage._id.toString(),
          msg.senderId,
          msg.messageText,
          msg.senderName,
          msg.adRefParam,
          msg.messageId,
        );
      }
    } catch (err: any) {
      this.logger.error(`Facebook webhook error: ${err.message}`, err.stack);
    }
  }

  // ─── TikTok Incoming Messages ───────────────────────────────

  @Post('tiktok/:pageId')
  async handleTikTok(
    @Param('pageId') pageId: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    res.status(HttpStatus.OK).send('OK');

    try {
      const fanpage = await this.chatbotService.findFanpageByPageId(pageId);
      if (!fanpage) {
        this.logger.warn(`TikTok webhook: fanpage not found for pageId ${pageId}`);
        return;
      }

      // Verify signature if appSecret is configured
      const signature = req.headers['x-tiktok-signature'] as string;
      if (fanpage.appSecret && signature) {
        const appSecret = this.chatbotService.getDecryptedAppSecret(fanpage);
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        if (!this.webhookService.verifyTikTokSignature(rawBody, signature, appSecret)) {
          this.logger.warn(`TikTok webhook: signature verification failed for pageId ${pageId}`);
          return;
        }
      }

      const messages = this.webhookService.parseTikTokWebhookPayload(req.body);
      for (const msg of messages) {
        await this.chatbotService.handleIncomingCustomerMessage(
          fanpage._id.toString(),
          msg.senderId,
          msg.messageText,
          msg.senderName,
          msg.adRefParam,
          msg.messageId,
        );
      }
    } catch (err: any) {
      this.logger.error(`TikTok webhook error: ${err.message}`, err.stack);
    }
  }
}
