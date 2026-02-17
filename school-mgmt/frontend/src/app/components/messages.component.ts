import { Component, signal, inject, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MessageService } from '../services/message.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface Participant {
  _id: string;
  fullName: string;
  role: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  _id: string;
  senderId: { _id: string; fullName: string; role: string };
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface UserItem {
  _id: string;
  fullName: string;
  role: string;
  email: string;
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Tin nhan noi bo</h2>
      <p>Trao doi tin nhan giua cac nhan vien.</p>
    </div>
    <button class="primary" (click)="toggleNewConversation()">
      + Tin nhan moi
    </button>
  </header>

  <div class="msg-layout">
    <!-- LEFT: Conversation List -->
    <div class="conv-list-panel">
      <div class="list-search">
        <input placeholder="Tim kiem hoi thoai..." [(ngModel)]="searchKeyword" (ngModelChange)="filterConversations()" />
      </div>

      <div class="conv-cards" *ngIf="filteredConversations().length; else emptyConvs">
        <div class="conv-card"
          *ngFor="let c of filteredConversations()"
          [class.selected]="selectedConv()?._id === c._id"
          (click)="selectConversation(c)">
          <div class="conv-card-header">
            <span class="contact-name">{{getOtherParticipantName(c)}}</span>
            <span class="conv-time">{{formatTime(c.lastMessageAt)}}</span>
          </div>
          <div class="conv-card-preview">
            <span class="last-msg">{{c.lastMessage || 'Chua co tin nhan'}}</span>
            <span class="unread-badge" *ngIf="c.unreadCount > 0">{{c.unreadCount}}</span>
          </div>
        </div>
      </div>
      <ng-template #emptyConvs>
        <div class="empty-list">Chua co hoi thoai nao.</div>
      </ng-template>
    </div>

    <!-- RIGHT: Chat Panel -->
    <div class="chat-panel" *ngIf="selectedConv() || showNewChat(); else noSelection">
      <!-- New conversation header -->
      <div class="chat-header" *ngIf="showNewChat() && !selectedConv()">
        <div class="chat-header-info">
          <strong>Tin nhan moi</strong>
        </div>
        <div class="new-chat-recipient">
          <label>Gui den:</label>
          <select [(ngModel)]="selectedUserId" (ngModelChange)="onRecipientSelected()">
            <option value="">-- Chon nhan vien --</option>
            <option *ngFor="let u of availableUsers()" [value]="u._id">
              {{u.fullName}} ({{roleLabel(u.role)}})
            </option>
          </select>
        </div>
      </div>

      <!-- Existing conversation header -->
      <div class="chat-header" *ngIf="selectedConv()">
        <div class="chat-header-info">
          <strong>{{getOtherParticipantName(selectedConv()!)}}</strong>
          <span class="role-tag">{{getOtherParticipantRole(selectedConv()!)}}</span>
        </div>
      </div>

      <!-- Messages Area -->
      <div class="messages-area" #messagesArea>
        <div class="messages-list">
          <div *ngFor="let msg of messages()"
            class="message-bubble"
            [class.sent]="msg.senderId._id === currentUserId()"
            [class.received]="msg.senderId._id !== currentUserId()">
            <div class="msg-sender" *ngIf="msg.senderId._id !== currentUserId()">
              <span class="sender-label">{{msg.senderId.fullName}}</span>
            </div>
            <div class="msg-content">{{msg.content}}</div>
            <div class="msg-meta">
              <span class="msg-time">{{formatTime(msg.createdAt)}}</span>
              <span class="msg-read" *ngIf="msg.senderId._id === currentUserId() && msg.readAt">Da doc</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="chat-input">
        <textarea [(ngModel)]="messageInput" placeholder="Nhap tin nhan..." rows="2"
          (keydown.enter)="$event.preventDefault(); sendMessage()"
          [disabled]="sending() || (showNewChat() && !selectedUserId && !selectedConv())"></textarea>
        <button class="primary" (click)="sendMessage()"
          [disabled]="!messageInput.trim() || sending() || (showNewChat() && !selectedUserId && !selectedConv())">
          {{sending() ? 'Dang gui...' : 'Gui'}}
        </button>
      </div>
    </div>

    <ng-template #noSelection>
      <div class="chat-panel no-selection">
        <div class="empty-chat">Chon mot hoi thoai hoac tao tin nhan moi</div>
      </div>
    </ng-template>
  </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; height: calc(100vh - 70px); box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }

    .page-header { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    .page-header h2 { margin: 0 0 4px; font-size: 22px; color: #1f2937; }
    .page-header p { margin: 0; color: #666; font-size: 14px; }

    .msg-layout { display: flex; gap: 16px; height: calc(100% - 60px); }

    /* LEFT PANEL */
    .conv-list-panel { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; overflow: hidden; }
    .list-search { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .list-search input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; }
    .list-search input:focus { outline: none; border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,.15); }
    .conv-cards { flex: 1; overflow-y: auto; }
    .conv-card { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background .15s; }
    .conv-card:hover { background: #fef3e2; }
    .conv-card.selected { background: #fff7ed; border-left: 3px solid #f97316; }
    .conv-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .contact-name { font-weight: 600; font-size: 13px; color: #1f2937; }
    .conv-time { font-size: 11px; color: #9ca3af; }
    .conv-card-preview { display: flex; justify-content: space-between; align-items: center; }
    .last-msg { font-size: 12px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px; }
    .unread-badge { background: #f97316; color: #fff; font-size: 10px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 5px; flex-shrink: 0; }
    .empty-list { text-align: center; padding: 40px 16px; color: #9ca3af; font-size: 13px; }

    /* RIGHT PANEL */
    .chat-panel { flex: 1; display: flex; flex-direction: column; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; overflow: hidden; min-width: 0; }
    .chat-panel.no-selection { justify-content: center; align-items: center; }
    .empty-chat { color: #9ca3af; font-size: 14px; }

    .chat-header { padding: 14px 20px; border-bottom: 1px solid #e5e7eb; background: #1f2937; color: #fff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .chat-header-info { display: flex; align-items: center; gap: 10px; }
    .chat-header-info strong { font-size: 15px; }
    .role-tag { font-size: 11px; background: rgba(255,255,255,.15); padding: 2px 8px; border-radius: 10px; }

    .new-chat-recipient { display: flex; align-items: center; gap: 8px; }
    .new-chat-recipient label { font-size: 13px; white-space: nowrap; }
    .new-chat-recipient select { padding: 6px 10px; border: 1px solid rgba(255,255,255,.3); border-radius: 6px; font-size: 12px; background: rgba(255,255,255,.1); color: #fff; min-width: 200px; }
    .new-chat-recipient select option { color: #1f2937; background: #fff; }

    .messages-area { flex: 1; overflow-y: auto; padding: 20px; background: #f8fafc; }
    .messages-list { display: flex; flex-direction: column; gap: 10px; }

    .message-bubble { max-width: 70%; padding: 10px 14px; border-radius: 14px; }
    .message-bubble.received { align-self: flex-start; background: #fff; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
    .message-bubble.sent { align-self: flex-end; background: #f97316; color: #fff; border-bottom-right-radius: 4px; margin-left: auto; }
    .msg-sender { margin-bottom: 2px; }
    .sender-label { font-size: 11px; font-weight: 600; color: #f97316; }
    .msg-content { font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .msg-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; justify-content: flex-end; }
    .msg-time { font-size: 10px; opacity: .7; }
    .message-bubble.sent .msg-time { color: rgba(255,255,255,.8); }
    .message-bubble.received .msg-time { color: #9ca3af; }
    .msg-read { font-size: 9px; color: rgba(255,255,255,.7); }

    .chat-input { padding: 14px 20px; border-top: 1px solid #e5e7eb; display: flex; gap: 10px; align-items: flex-end; }
    .chat-input textarea { flex: 1; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 13px; resize: none; font-family: inherit; }
    .chat-input textarea:focus { outline: none; border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,.15); }

    /* Buttons */
    button.primary { padding: 8px 20px; background: #f97316; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: background .15s; }
    button.primary:hover { background: #ea580c; }
    button.primary:disabled { opacity: .6; cursor: not-allowed; }

    @media (max-width: 900px) {
      .msg-layout { flex-direction: column; height: auto; }
      .conv-list-panel, .chat-panel { width: 100%; }
      .chat-panel { min-height: 400px; }
    }
  `],
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesArea') messagesArea!: ElementRef;

  private messageService = inject(MessageService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  // State
  conversations = signal<Conversation[]>([]);
  filteredConversations = signal<Conversation[]>([]);
  selectedConv = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  allUsers = signal<UserItem[]>([]);
  availableUsers = signal<UserItem[]>([]);

  searchKeyword = '';
  messageInput = '';
  selectedUserId = '';
  sending = signal(false);
  showNewChat = signal(false);

  currentUserId = signal('');

  private convPollingInterval: any = null;
  private msgPollingInterval: any = null;

  ngOnInit() {
    const user = this.authService.userSignal();
    if (user) {
      this.currentUserId.set(user.sub);
    }
    this.loadConversations();
    this.loadUsers();
    this.convPollingInterval = setInterval(() => this.loadConversations(), 10000);
  }

  ngOnDestroy() {
    if (this.convPollingInterval) clearInterval(this.convPollingInterval);
    if (this.msgPollingInterval) clearInterval(this.msgPollingInterval);
  }

  // ─── Data loading ────────────────────────────────────────────

  async loadConversations() {
    try {
      const data = await this.messageService.listConversations();
      this.conversations.set(data);
      this.filterConversations();

      // If a conversation is selected, update its unread count
      const sel = this.selectedConv();
      if (sel) {
        const updated = data.find((c: Conversation) => c._id === sel._id);
        if (updated) {
          this.selectedConv.set(updated);
        }
      }
    } catch {}
  }

  async loadUsers() {
    try {
      const data = await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users`, { withCredentials: true }),
      );
      const currentId = this.currentUserId();
      this.allUsers.set(data);
      this.availableUsers.set(data.filter(u => u._id !== currentId));
    } catch {}
  }

  filterConversations() {
    const kw = this.searchKeyword.toLowerCase().trim();
    if (!kw) {
      this.filteredConversations.set(this.conversations());
      return;
    }
    this.filteredConversations.set(
      this.conversations().filter(c => {
        const otherName = this.getOtherParticipantName(c).toLowerCase();
        const lastMsg = (c.lastMessage || '').toLowerCase();
        return otherName.includes(kw) || lastMsg.includes(kw);
      }),
    );
  }

  // ─── Conversation selection ──────────────────────────────────

  async selectConversation(conv: Conversation) {
    this.showNewChat.set(false);
    this.selectedUserId = '';
    this.selectedConv.set(conv);
    await this.loadMessages(conv._id);
    this.markAsRead(conv);
    this.startMessagePolling(conv._id);
  }

  async loadMessages(conversationId: string) {
    try {
      const res = await this.messageService.listMessages(conversationId, 1, 100);
      const msgs: Message[] = res.messages || res;
      this.messages.set(msgs);
      setTimeout(() => this.scrollToBottom(), 100);
    } catch {}
  }

  async markAsRead(conv: Conversation) {
    if (conv.unreadCount > 0) {
      try {
        await this.messageService.markRead(conv._id);
        // Update local unread count
        const updated = { ...conv, unreadCount: 0 };
        this.selectedConv.set(updated);
        this.conversations.update(list =>
          list.map(c => c._id === conv._id ? updated : c),
        );
        this.filterConversations();
      } catch {}
    }
  }

  private startMessagePolling(conversationId: string) {
    if (this.msgPollingInterval) clearInterval(this.msgPollingInterval);
    this.msgPollingInterval = setInterval(async () => {
      const sel = this.selectedConv();
      if (!sel || sel._id !== conversationId) return;
      try {
        const res = await this.messageService.listMessages(conversationId, 1, 100);
        const msgs: Message[] = res.messages || res;
        const oldCount = this.messages().length;
        this.messages.set(msgs);
        if (msgs.length > oldCount) {
          setTimeout(() => this.scrollToBottom(), 100);
          this.markAsRead(sel);
        }
      } catch {}
    }, 5000);
  }

  // ─── New conversation ────────────────────────────────────────

  toggleNewConversation() {
    this.showNewChat.set(!this.showNewChat());
    if (this.showNewChat()) {
      this.selectedConv.set(null);
      this.messages.set([]);
      this.selectedUserId = '';
      this.messageInput = '';
      if (this.msgPollingInterval) clearInterval(this.msgPollingInterval);
    }
  }

  onRecipientSelected() {
    // Check if there is already a conversation with this user
    if (!this.selectedUserId) return;
    const existing = this.conversations().find(c =>
      c.participants.some(p => p._id === this.selectedUserId),
    );
    if (existing) {
      this.selectConversation(existing);
      this.showNewChat.set(false);
    }
  }

  // ─── Send message ────────────────────────────────────────────

  async sendMessage() {
    const content = this.messageInput.trim();
    if (!content) return;
    this.sending.set(true);

    try {
      const sel = this.selectedConv();
      if (sel) {
        // Send to existing conversation
        await this.messageService.sendToConversation(sel._id, content);
        this.messageInput = '';
        await this.loadMessages(sel._id);
        await this.loadConversations();
      } else if (this.selectedUserId) {
        // Send new message to user
        await this.messageService.sendMessage(this.selectedUserId, content);
        this.messageInput = '';
        this.showNewChat.set(false);
        // Reload conversations and select the new one
        await this.loadConversations();
        const newConv = this.conversations().find(c =>
          c.participants.some(p => p._id === this.selectedUserId),
        );
        if (newConv) {
          this.selectedConv.set(newConv);
          await this.loadMessages(newConv._id);
          this.startMessagePolling(newConv._id);
        }
        this.selectedUserId = '';
      }
    } catch {}

    this.sending.set(false);
  }

  // ─── Helpers ─────────────────────────────────────────────────

  getOtherParticipantName(conv: Conversation): string {
    const currentId = this.currentUserId();
    const other = conv.participants.find(p => p._id !== currentId);
    return other?.fullName || 'Khong ro';
  }

  getOtherParticipantRole(conv: Conversation): string {
    const currentId = this.currentUserId();
    const other = conv.participants.find(p => p._id !== currentId);
    return other ? this.roleLabel(other.role) : '';
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      admin: 'Quan tri',
      manager: 'Quan ly',
      teacher: 'Giao vien',
      staff: 'Nhan vien',
      sale: 'Sale',
      accountant: 'Ke toan',
    };
    return map[role] || role;
  }

  formatTime(d?: string): string {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Vua xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phut`;
    if (diff < 86400000) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  private scrollToBottom() {
    try {
      if (this.messagesArea?.nativeElement) {
        this.messagesArea.nativeElement.scrollTop = this.messagesArea.nativeElement.scrollHeight;
      }
    } catch {}
  }
}
