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
    .login-wrapper { display:flex; align-items:center; justify-content:center; min-height:100vh; background:var(--bg); padding:16px; }
    .login-card { background:var(--surface); padding:24px; border-radius:12px; box-shadow:var(--shadow); width:340px; display:flex; flex-direction:column; gap:12px; border:1px solid var(--border); color:var(--text); }
    label { display:flex; flex-direction:column; font-size:14px; color:var(--muted); }
    input { padding:10px; border:1px solid var(--border); border-radius:8px; background:var(--panel); color:var(--text); }
    button { padding:12px; border:1px solid var(--primary-strong); border-radius:10px; background:var(--primary); color:#04121a; font-weight:700; cursor:pointer; }
    button:hover { background:var(--primary-strong); }
    .error { color:var(--danger); font-size:13px; margin:0; }
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
