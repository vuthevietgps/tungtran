import { HttpStatus } from '@nestjs/common';
import { WebhookController } from './webhook.controller';

describe('WebhookController', () => {
  const chatbotService = {
    findFanpageByPageId: jest.fn(),
    getDecryptedAppSecret: jest.fn(),
    handleIncomingCustomerMessage: jest.fn(),
  };

  const webhookService = {
    verifyFacebookWebhook: jest.fn(),
    verifyFacebookSignature: jest.fn(),
    parseFacebookWebhookPayload: jest.fn(),
    verifyTikTokSignature: jest.fn(),
    parseTikTokWebhookPayload: jest.fn(),
  };

  let controller: WebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WebhookController(chatbotService as any, webhookService as any);
  });

  it('does not process Facebook message when appSecret is set but signature is missing', async () => {
    chatbotService.findFanpageByPageId.mockResolvedValue({
      _id: { toString: () => 'fanpage-1' },
      appSecret: 'encrypted-secret',
    });
    webhookService.parseFacebookWebhookPayload.mockReturnValue([
      {
        senderId: 'sender-1',
        messageText: 'hello',
        senderName: 'User 1',
        adRefParam: '',
        messageId: 'msg-1',
      },
    ]);

    const req: any = {
      headers: {},
      body: {},
      rawBody: Buffer.from('{}'),
    };
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const res: any = { status, send };

    await controller.handleFacebook('page-1', req, res);

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(send).toHaveBeenCalledWith('EVENT_RECEIVED');
    expect(webhookService.parseFacebookWebhookPayload).not.toHaveBeenCalled();
    expect(chatbotService.handleIncomingCustomerMessage).not.toHaveBeenCalled();
  });

  it('processes Facebook message when signature is present and valid', async () => {
    chatbotService.findFanpageByPageId.mockResolvedValue({
      _id: { toString: () => 'fanpage-2' },
      appSecret: 'encrypted-secret',
    });
    chatbotService.getDecryptedAppSecret.mockReturnValue('plain-secret');
    webhookService.verifyFacebookSignature.mockReturnValue(true);
    webhookService.parseFacebookWebhookPayload.mockReturnValue([
      {
        senderId: 'sender-2',
        messageText: 'ping',
        senderName: 'User 2',
        adRefParam: 'ad-1',
        messageId: 'msg-2',
      },
    ]);

    const req: any = {
      headers: { 'x-hub-signature-256': 'sha256=dummy' },
      body: { object: 'page' },
      rawBody: Buffer.from('{"object":"page"}'),
    };
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const res: any = { status, send };

    await controller.handleFacebook('page-2', req, res);

    expect(webhookService.verifyFacebookSignature).toHaveBeenCalled();
    expect(webhookService.parseFacebookWebhookPayload).toHaveBeenCalled();
    expect(chatbotService.handleIncomingCustomerMessage).toHaveBeenCalledTimes(1);
  });
});
