import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MessageDocument } from './schemas/message.schema';
import { ConversationDocument } from './schemas/conversation.schema';
import { DIRECT_CONVERSATION_MODEL, DIRECT_MESSAGE_MODEL } from './messages.constants';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(DIRECT_MESSAGE_MODEL) private messageModel: Model<MessageDocument>,
    @InjectModel(DIRECT_CONVERSATION_MODEL) private conversationModel: Model<ConversationDocument>,
  ) {}

  /** Get or create a 1-on-1 conversation between two users */
  async getOrCreateConversation(userId1: string, userId2: string): Promise<ConversationDocument> {
    const id1 = new Types.ObjectId(userId1);
    const id2 = new Types.ObjectId(userId2);

    let convo = await this.conversationModel.findOne({
      participants: { $all: [id1, id2], $size: 2 },
    });

    if (!convo) {
      convo = await this.conversationModel.create({
        participants: [id1, id2],
      });
    }

    return convo;
  }

  /** Send a message to a specific user (creates conversation if needed) */
  async sendMessage(senderId: string, receiverId: string, content: string) {
    const convo = await this.getOrCreateConversation(senderId, receiverId);

    const message = await this.messageModel.create({
      conversationId: convo._id,
      senderId: new Types.ObjectId(senderId),
      content,
    });

    // Update conversation last message
    convo.lastMessage = content.substring(0, 100);
    convo.lastMessageBy = new Types.ObjectId(senderId);
    convo.lastMessageAt = new Date();
    await convo.save();

    return message;
  }

  /** Send a message to an existing conversation */
  async sendToConversation(senderId: string, conversationId: string, content: string) {
    const convo = await this.conversationModel.findById(conversationId);
    if (!convo) throw new NotFoundException('Conversation not found');

    // Verify sender is a participant
    const isParticipant = convo.participants.some(
      (p) => p.toString() === senderId,
    );
    if (!isParticipant) throw new NotFoundException('Conversation not found');

    const message = await this.messageModel.create({
      conversationId: convo._id,
      senderId: new Types.ObjectId(senderId),
      content,
    });

    convo.lastMessage = content.substring(0, 100);
    convo.lastMessageBy = new Types.ObjectId(senderId);
    convo.lastMessageAt = new Date();
    await convo.save();

    return message;
  }

  /** List all conversations for a user */
  async listConversations(userId: string) {
    const uid = new Types.ObjectId(userId);

    const conversations = await this.conversationModel
      .find({ participants: uid })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'fullName email role')
      .lean();

    // Get unread counts for each conversation
    const result = await Promise.all(
      conversations.map(async (convo) => {
        const unreadCount = await this.messageModel.countDocuments({
          conversationId: convo._id,
          senderId: { $ne: uid },
          readAt: null,
        });
        return { ...convo, unreadCount };
      }),
    );

    return result;
  }

  /** List messages in a conversation (paginated) */
  async listMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 50,
  ) {
    const convo = await this.conversationModel.findById(conversationId);
    if (!convo) throw new NotFoundException('Conversation not found');

    const isParticipant = convo.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new NotFoundException('Conversation not found');

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: convo._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'fullName email role')
        .lean(),
      this.messageModel.countDocuments({ conversationId: convo._id }),
    ]);

    return { messages: messages.reverse(), total, page, limit };
  }

  /** Mark all messages in a conversation as read (for the current user) */
  async markRead(userId: string, conversationId: string) {
    const uid = new Types.ObjectId(userId);
    const convo = await this.conversationModel.findById(conversationId);
    if (!convo) throw new NotFoundException('Conversation not found');

    const isParticipant = convo.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new NotFoundException('Conversation not found');

    const result = await this.messageModel.updateMany(
      {
        conversationId: convo._id,
        senderId: { $ne: uid },
        readAt: null,
      },
      { $set: { readAt: new Date() } },
    );

    return { marked: result.modifiedCount };
  }

  /** Get total unread message count for a user */
  async getUnreadCount(userId: string) {
    const uid = new Types.ObjectId(userId);

    // Get all conversation IDs where user is participant
    const convos = await this.conversationModel
      .find({ participants: uid })
      .select('_id')
      .lean();

    const convoIds = convos.map((c) => c._id);

    const count = await this.messageModel.countDocuments({
      conversationId: { $in: convoIds },
      senderId: { $ne: uid },
      readAt: null,
    });

    return { count };
  }
}
