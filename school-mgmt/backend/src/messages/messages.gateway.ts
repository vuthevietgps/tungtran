import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/messages',
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  /** Map userId → Set<socketId> for broadcasting */
  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly messagesService: MessagesService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query['userId'] as string;
    if (!userId) {
      client.disconnect();
      return;
    }
    client.data.userId = userId;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    // Join personal room
    client.join(`user:${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; content: string },
  ) {
    const senderId = client.data.userId;
    if (!senderId) return;

    const message = await this.messagesService.sendMessage(
      senderId,
      data.receiverId,
      data.content,
    );

    // Emit to receiver
    this.server.to(`user:${data.receiverId}`).emit('newMessage', {
      message,
      senderId,
    });

    // Emit confirmation to sender
    client.emit('messageSent', { message });
  }

  @SubscribeMessage('sendToConversation')
  async handleSendToConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const senderId = client.data.userId;
    if (!senderId) return;

    const message = await this.messagesService.sendToConversation(
      senderId,
      data.conversationId,
      data.content,
    );

    // Broadcast to all participants in the conversation room
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('newMessage', { message, senderId });
  }

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    await this.messagesService.markRead(userId, data.conversationId);
  }
}
