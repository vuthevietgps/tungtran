import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatbotController } from './chatbot.controller';
import { WebhookController } from './webhook.controller';
import { ChatbotService } from './chatbot.service';
import { WebhookService } from './webhook.service';
import { Fanpage, FanpageSchema } from './schemas/fanpage.schema';
import { OpenAIToken, OpenAITokenSchema } from './schemas/openai-token.schema';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { AdGroup, AdGroupSchema } from '../ads/schemas/ad-group.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Fanpage.name, schema: FanpageSchema },
      { name: OpenAIToken.name, schema: OpenAITokenSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    AuditLogModule,
  ],
  controllers: [ChatbotController, WebhookController],
  providers: [ChatbotService, WebhookService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
