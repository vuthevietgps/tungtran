import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <section class="login-wrapper">
    <form (ngSubmit)="submit()" class="login-card">
      <h2>Đăng nhập</h2>
      <label>Email
        <input type="email" [(ngModel)]="email" name="email" required />
      </label>
      <label>Mật khẩu
        <input type="password" [(ngModel)]="password" name="password" required />
      </label>
      <button type="submit">Đăng nhập</button>
      <p class="error" *ngIf="error()">{{error()}}</p>
    </form>
  </section>
  `,
  styles: [`
    .login-wrapper { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f1f5f9; }
    .login-card { background:#fff; padding:24px; border-radius:8px; box-shadow:0 8px 24px rgba(15,23,42,.15); width:320px; display:flex; flex-direction:column; gap:12px; }
    label { display:flex; flex-direction:column; font-size:14px; color:#475569; }
    input { padding:8px; border:1px solid #cbd5f5; border-radius:6px; }
    button { padding:10px; border:none; border-radius:6px; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; }
    button:hover { background:#1d4ed8; }
    .error { color:#dc2626; font-size:13px; margin:0; }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  async submit() {
    const ok = await this.auth.login(this.email, this.password);
    if (!ok) {
      this.error.set('Sai email hoặc mật khẩu');
      return;
    }
    this.router.navigate(['/app/users']);
  }
}
