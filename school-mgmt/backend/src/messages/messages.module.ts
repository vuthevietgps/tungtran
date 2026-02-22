import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageSchema } from './schemas/message.schema';
import { ConversationSchema } from './schemas/conversation.schema';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { DIRECT_CONVERSATION_MODEL, DIRECT_MESSAGE_MODEL } from './messages.constants';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DIRECT_MESSAGE_MODEL, schema: MessageSchema, collection: 'direct_messages' },
      { name: DIRECT_CONVERSATION_MODEL, schema: ConversationSchema, collection: 'direct_conversations' },
    ]),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesService],
})
export class MessagesModule {}
