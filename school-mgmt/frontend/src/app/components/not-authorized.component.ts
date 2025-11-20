import { Component } from '@angular/core';

@Component({
  selector: 'app-not-authorized',
  standalone: true,
  template: `<section class="notice"><h2>Không có quyền truy cập</h2><p>Vui lòng liên hệ quản trị.</p></section>`,
  styles: [`.notice{padding:60px;text-align:center;color:#475569;}`]
})
export class NotAuthorizedComponent {}
