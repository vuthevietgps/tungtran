import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StudentItem, StudentService } from '../services/student.service';
import { ProductItem, ProductService } from '../services/product.service';
import { AuthService } from '../services/auth.service';
import { UserItem, UserService } from '../services/user.service';
import { InvoiceService } from '../services/invoice.service';

interface StudentForm {
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage: string;
  productPackage: string;
  studentType: 'ONLINE' | 'OFFLINE' | '';
  saleId: string;
  saleName: string;
  invoiceImage: string;
  sessionsRegistered: number | null;
  pricePerSession: number | null;
  amountCollected: number | null;
  sessionsCollected: number | null;
  confirmStatus: 'PENDING' | 'CONFIRMED' | '';
  // Payment frames 2-10
  sessionsRegistered2: number | null; pricePerSession2: number | null; amountCollected2: number | null; sessionsCollected2: number | null; invoiceImage2: string; confirmStatus2: 'PENDING' | 'CONFIRMED' | '';
  sessionsRegistered3: number | null; pricePerSession3: number | null; amountCollected3: number | null; sessionsCollected3: number | null; invoiceImage3: string; confirmStatus3: 'PENDING' | 'CONFIRMED' | '';
  sessionsRegistered4: number | null; pricePerSession4: number | null; amountCollected4: number | null; sessionsCollected4: number | null; invoiceImage4: string; confirmStatus4: 'PENDING' | 'CONFIRMED' | '';
  sessionsRegistered5: number | null; pricePerSession5: number | null; amountCollected5: number | null; sessionsCollected5: number | null; invoiceImage5: string; confirmStatus5: 'PENDING' | 'CONFIRMED' | '';
  sessionsRegistered6: number | null; pricePerSession6: number | null; amountCollected6: number | null; sessionsCollected6: number | null; invoiceImage6: string; confirmStatus6: 'PENDING' | 'CONFIRMED' | '';
  sessionsRegistered7: number | null; pricePerSession7: number | null; amountCollected7: number | null; sessionsCollected7: number | null; invoiceImage7: string; confirmStatus7: 'PENDING' | 'CONFIRMED' | '';
  sessionsRegistered8: number | null; pricePerSession8: number | null; amountCollected8: number | null; sessionsCollected8: number | null; invoiceImage8: string; confirmStatus8: 'PENDING' | 'CONFIRMED' | '';
  sessionsRegistered9: number | null; pricePerSession9: number | null; amountCollected9: number | null; sessionsCollected9: number | null; invoiceImage9: string; confirmStatus9: 'PENDING' | 'CONFIRMED' | '';
  sessionsRegistered10: number | null; pricePerSession10: number | null; amountCollected10: number | null; sessionsCollected10: number | null; invoiceImage10: string; confirmStatus10: 'PENDING' | 'CONFIRMED' | ''; invoiceCode10: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | '';
  // Invoice codes for all frames
  invoiceCode: string; invoiceCode2: string; invoiceCode3: string; invoiceCode4: string; invoiceCode5: string; invoiceCode6: string; invoiceCode7: string; invoiceCode8: string; invoiceCode9: string;
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-header">
      <div>
        <h2>Quản lý học sinh</h2>
        <p>Theo dõi thông tin phụ huynh và ảnh nhận diện.</p>
      </div>
      <div class="header-actions">
        <button class="secondary" *ngIf="canApprove" (click)="showPendingApproval()">Chờ duyệt ({{pendingCount()}})</button>
        <button class="danger" *ngIf="canDeleteStudents" (click)="clearAllData()">🗑️ Xóa tất cả dữ liệu</button>
        <button class="primary" (click)="openModal()">+ Thêm học sinh</button>
      </div>
    </header>

    <section class="filters">
      <input placeholder="Tìm theo tên hoặc mã học sinh" [(ngModel)]="keyword" />
      <button (click)="reload()">Làm mới</button>
    </section>

    <table class="data" *ngIf="filtered().length; else empty">
      <thead>
        <tr>
          <th>Ảnh</th>
          <th>Mã học sinh</th>
          <th>Họ và tên</th>
          <th>Tuổi</th>
          <th>Tên phụ huynh</th>
          <th>Điện thoại</th>
          <th>Gói sản phẩm</th>
          <th>Thanh toán lần 1</th>
          <th>Thanh toán lần 2</th>
          <th>Thanh toán lần 3</th>
          <th>Thanh toán lần 4</th>
          <th>Thanh toán lần 5</th>
          <th>Thanh toán lần 6</th>
          <th>Thanh toán lần 7</th>
          <th>Thanh toán lần 8</th>
          <th>Thanh toán lần 9</th>
          <th>Thanh toán lần 10</th>
          <th>Trạng thái</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let s of filtered()">
          <td><img [src]="s.faceImage" alt="{{s.fullName}}" /></td>
          <td><strong>{{s.studentCode}}</strong></td>
          <td>{{s.fullName}}</td>
          <td>{{s.age}}</td>
          <td>{{s.parentName}}</td>
          <td>{{s.parentPhone}}</td>
          <td>{{ s.productPackage?.name || '-' }}</td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 1)">{{getPaymentStatusText(s, 1)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 2)">{{getPaymentStatusText(s, 2)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 3)">{{getPaymentStatusText(s, 3)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 4)">{{getPaymentStatusText(s, 4)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 5)">{{getPaymentStatusText(s, 5)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 6)">{{getPaymentStatusText(s, 6)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 7)">{{getPaymentStatusText(s, 7)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 8)">{{getPaymentStatusText(s, 8)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 9)">{{getPaymentStatusText(s, 9)}}</span></td>
          <td class="payment-status"><span class="payment-badge" [class]="getPaymentStatusClass(s, 10)">{{getPaymentStatusText(s, 10)}}</span></td>
          <td><span class="status-badge" [class]="getStatusClass(s)">{{getStatusText(s)}}</span></td>
          <td class="actions-cell">
            <button class="ghost" (click)="edit(s)">Sửa</button>
            <button class="ghost success" (click)="approve(s._id, 'APPROVE')" *ngIf="canApprove && isPending(s)">Duyệt</button>
            <button class="ghost danger" (click)="approve(s._id, 'REJECT')" *ngIf="canApprove && isPending(s)">Từ chối</button>
            <button class="ghost" (click)="remove(s)" *ngIf="canDeleteStudents">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #empty><p>Chưa có học sinh.</p></ng-template>

    <div class="modal-backdrop" *ngIf="showModal()">
      <div class="modal modern-modal">
        <header class="modal-header">
          <div>
            <h3>{{ editingStudent ? 'Sửa học sinh' : 'Thêm học sinh' }}</h3>
            <p>Nhập thông tin học sinh và đăng ký khóa học.</p>
          </div>
          <button type="button" class="close" (click)="closeModal()">✕</button>
        </header>

        <form (ngSubmit)="submit()" #f="ngForm" class="modal-grid">
          <section class="card">
            <h4>Thông tin học sinh</h4>
            <div class="grid-3">
              <label>Mã học sinh
                <input name="studentCode" [(ngModel)]="form.studentCode" placeholder="Ví dụ: HS001" required />
              </label>
              <label>Họ và tên
                <input name="fullName" [(ngModel)]="form.fullName" required />
              </label>
              <label>Tuổi
                <input name="age" type="number" min="3" max="25" [(ngModel)]="form.age" required />
              </label>
              <label>Loại học sinh
                <select name="studentType" [(ngModel)]="form.studentType">
                  <option value="">-- Chọn loại --</option>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </label>
              <label>Tên phụ huynh
                <input name="parentName" [(ngModel)]="form.parentName" required />
              </label>
              <label>Điện thoại phụ huynh
                <input name="parentPhone" [(ngModel)]="form.parentPhone" required />
              </label>
            </div>
          </section>

          <section class="card">
            <h4>Ảnh nhận diện</h4>
            <div class="grid-1">
              <label>Ảnh nhận diện
                <input type="file" accept="image/*" (change)="handleFileChange($event)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.faceImage">
                <img [src]="form.faceImage" alt="Ảnh nhận diện" />
                <span>Ảnh nhận diện</span>
              </div>
              <div class="upload-status">
                <span *ngIf="uploading()">Đang tải ảnh...</span>
                <span class="error" *ngIf="uploadError()">{{uploadError()}}</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Khóa học & sale</h4>
            <div class="grid-2">
              <label>Gói sản phẩm
                <select name="productPackage" [(ngModel)]="form.productPackage">
                  <option value="">-- Chọn gói --</option>
                  <option *ngFor="let p of products()" [value]="p._id">{{ p.name }}</option>
                </select>
              </label>
              <label>Tên sale
                <select name="saleId" [(ngModel)]="form.saleId" (ngModelChange)="onSaleChange($event)">
                  <option value="">-- Chọn sale --</option>
                  <option *ngFor="let u of sales()" [value]="u._id">{{ u.fullName }}</option>
                </select>
              </label>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 1</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode" [(ngModel)]="form.invoiceCode" placeholder="Ví dụ: HD001" />
              </label>
              <label>Số buổi học đăng ký lần 1
                <input name="sessionsRegistered" type="number" min="0" [(ngModel)]="form.sessionsRegistered" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected" type="number" min="0" [(ngModel)]="form.sessionsCollected" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 1)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage">
                <img [src]="form.invoiceImage" alt="Ảnh hóa đơn" />
                <span>Ảnh hóa đơn</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 2</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode2" [(ngModel)]="form.invoiceCode2" placeholder="Ví dụ: HD002" />
              </label>
              <label>Số buổi học đăng ký lần 2
                <input name="sessionsRegistered2" type="number" min="0" [(ngModel)]="form.sessionsRegistered2" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession2" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession2" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected2" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected2" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected2" type="number" min="0" [(ngModel)]="form.sessionsCollected2" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 2)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage2">
                <img [src]="form.invoiceImage2" alt="Ảnh hóa đơn lần 2" />
                <span>Ảnh hóa đơn lần 2</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 3</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode3" [(ngModel)]="form.invoiceCode3" placeholder="Ví dụ: HD003" />
              </label>
              <label>Số buổi học đăng ký lần 3
                <input name="sessionsRegistered3" type="number" min="0" [(ngModel)]="form.sessionsRegistered3" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession3" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession3" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected3" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected3" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected3" type="number" min="0" [(ngModel)]="form.sessionsCollected3" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 3)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage3">
                <img [src]="form.invoiceImage3" alt="Ảnh hóa đơn lần 3" />
                <span>Ảnh hóa đơn lần 3</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 4</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode4" [(ngModel)]="form.invoiceCode4" placeholder="Ví dụ: HD004" />
              </label>
              <label>Số buổi học đăng ký lần 4
                <input name="sessionsRegistered4" type="number" min="0" [(ngModel)]="form.sessionsRegistered4" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession4" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession4" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected4" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected4" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected4" type="number" min="0" [(ngModel)]="form.sessionsCollected4" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 4)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage4">
                <img [src]="form.invoiceImage4" alt="Ảnh hóa đơn lần 4" />
                <span>Ảnh hóa đơn lần 4</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 5</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode5" [(ngModel)]="form.invoiceCode5" placeholder="Ví dụ: HD005" />
              </label>
              <label>Số buổi học đăng ký lần 5
                <input name="sessionsRegistered5" type="number" min="0" [(ngModel)]="form.sessionsRegistered5" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession5" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession5" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected5" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected5" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected5" type="number" min="0" [(ngModel)]="form.sessionsCollected5" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 5)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage5">
                <img [src]="form.invoiceImage5" alt="Ảnh hóa đơn lần 5" />
                <span>Ảnh hóa đơn lần 5</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 6</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode6" [(ngModel)]="form.invoiceCode6" placeholder="Ví dụ: HD006" />
              </label>
              <label>Số buổi học đăng ký lần 6
                <input name="sessionsRegistered6" type="number" min="0" [(ngModel)]="form.sessionsRegistered6" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession6" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession6" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected6" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected6" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected6" type="number" min="0" [(ngModel)]="form.sessionsCollected6" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 6)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage6">
                <img [src]="form.invoiceImage6" alt="Ảnh hóa đơn lần 6" />
                <span>Ảnh hóa đơn lần 6</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 7</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode7" [(ngModel)]="form.invoiceCode7" placeholder="Ví dụ: HD007" />
              </label>
              <label>Số buổi học đăng ký lần 7
                <input name="sessionsRegistered7" type="number" min="0" [(ngModel)]="form.sessionsRegistered7" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession7" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession7" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected7" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected7" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected7" type="number" min="0" [(ngModel)]="form.sessionsCollected7" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 7)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage7">
                <img [src]="form.invoiceImage7" alt="Ảnh hóa đơn lần 7" />
                <span>Ảnh hóa đơn lần 7</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 8</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode8" [(ngModel)]="form.invoiceCode8" placeholder="Ví dụ: HD008" />
              </label>
              <label>Số buổi học đăng ký lần 8
                <input name="sessionsRegistered8" type="number" min="0" [(ngModel)]="form.sessionsRegistered8" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession8" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession8" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected8" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected8" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected8" type="number" min="0" [(ngModel)]="form.sessionsCollected8" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 8)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage8">
                <img [src]="form.invoiceImage8" alt="Ảnh hóa đơn lần 8" />
                <span>Ảnh hóa đơn lần 8</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 9</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode9" [(ngModel)]="form.invoiceCode9" placeholder="Ví dụ: HD009" />
              </label>
              <label>Số buổi học đăng ký lần 9
                <input name="sessionsRegistered9" type="number" min="0" [(ngModel)]="form.sessionsRegistered9" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession9" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession9" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected9" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected9" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected9" type="number" min="0" [(ngModel)]="form.sessionsCollected9" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 9)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage9">
                <img [src]="form.invoiceImage9" alt="Ảnh hóa đơn lần 9" />
                <span>Ảnh hóa đơn lần 9</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h4>Thanh toán lần 10</h4>
            <div class="grid-4">
              <label>Mã hóa đơn
                <input name="invoiceCode10" [(ngModel)]="form.invoiceCode10" placeholder="Ví dụ: HD010" />
              </label>
              <label>Số buổi học đăng ký lần 10
                <input name="sessionsRegistered10" type="number" min="0" [(ngModel)]="form.sessionsRegistered10" />
              </label>
              <label>Số tiền/1 buổi
                <input name="pricePerSession10" type="number" min="0" step="1000" [(ngModel)]="form.pricePerSession10" />
              </label>
              <label>Số tiền đã thu
                <input name="amountCollected10" type="number" min="0" step="1000" [(ngModel)]="form.amountCollected10" />
              </label>
            </div>
            <div class="grid-4">
              <label>Số buổi đã thu tiền
                <input name="sessionsCollected10" type="number" min="0" [(ngModel)]="form.sessionsCollected10" />
              </label>
              <label></label>
              <label></label>
              <label></label>
            </div>
            <div class="grid-1">
              <label>Ảnh hóa đơn
                <input type="file" accept="image/*" (change)="handleReceiptUpload($event, 10)" />
              </label>
            </div>
            <div class="previews">
              <div class="preview-box" *ngIf="form.invoiceImage10">
                <img [src]="form.invoiceImage10" alt="Ảnh hóa đơn lần 10" />
                <span>Ảnh hóa đơn lần 10</span>
              </div>
            </div>
          </section>

          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="closeModal()">Hủy</button>
            <button type="submit" class="primary" [disabled]="uploading() || !form.faceImage">Lưu</button>
          </footer>
          <p class="error" *ngIf="error()">{{error()}}</p>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .filters { display:flex; gap:10px; margin-bottom:16px; }
    input { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; width:100%; }
    select { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; width:100%; background:#fff; }
    .data { width:100%; border-collapse:collapse; background:#fff; }
    th, td { padding:8px; border:1px solid #e2e8f0; vertical-align:middle; }
    thead { background:#f1f5f9; }
    img { width:44px; height:44px; object-fit:cover; border-radius:4px; border:1px solid #cbd5f5; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:6px 10px; border-radius:4px; cursor:pointer; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(2,8,23,.65); display:flex; align-items:center; justify-content:center; padding:24px; }
    .modal.modern-modal { background:linear-gradient(135deg,#0b1224,#0f1b33); color:#e2e8f0; padding:0; border-radius:16px; width:min(1200px, 95vw); max-height:90vh; box-shadow:0 30px 60px rgba(4,12,30,0.6); overflow:hidden; display:flex; flex-direction:column; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 20px; background:linear-gradient(135deg,#102044,#142a58); border-bottom:1px solid rgba(148,163,184,0.18); }
    .modal-header h3 { margin:0 0 4px 0; }
    .modal-header p { margin:0; font-size:12px; color:#cbd5f5; }
    .modal-header .close { border:none; background:rgba(8,17,33,0.6); color:#e2e8f0; width:36px; height:36px; border-radius:10px; cursor:pointer; }
    .modal-grid { display:flex; flex-direction:column; gap:16px; padding:20px; overflow-y:auto; flex:1; }
    .card { background:rgba(9,18,38,0.9); border:1px solid rgba(148,163,184,0.14); border-radius:12px; padding:14px; }
    .card h4 { margin:0 0 10px 0; font-size:14px; color:#93c5fd; }
    .grid-1 { display:grid; grid-template-columns: 1fr; gap:12px; }
    .grid-2 { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:12px; }
    .grid-3 { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px; }
    .grid-4 { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px; }
    label { display:flex; flex-direction:column; gap:6px; font-size:13px; color:#cbd5f5; }
    input, select { padding:10px 12px; border-radius:10px; border:1px solid rgba(99,102,241,0.35); background:rgba(12,23,45,0.85); color:#f8fafc; }
    input:focus, select:focus { outline:none; border-color:#60a5fa; box-shadow:0 0 0 1px rgba(96,165,250,0.45); }
    .previews { display:flex; gap:12px; align-items:flex-start; }
    .preview-box { display:flex; flex-direction:column; gap:6px; align-items:center; background:rgba(12,24,46,0.9); border:1px solid rgba(148,163,184,0.14); border-radius:12px; padding:10px; }
    .preview-box img { width:140px; height:140px; object-fit:cover; border-radius:10px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { width:120px; text-align:right; }
    .actions-cell button { margin-left:4px; }
    .error { color:#dc2626; }
    .upload-status { display:flex; flex-direction:column; gap:6px; font-size:12px; color:#cbd5f5; }
    .modal-actions { display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid rgba(148,163,184,0.18); background:rgba(9,18,38,0.7); }
    .header-actions { display:flex; gap:10px; align-items:center; }
    .secondary { background:#64748b; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .success { background:#059669; color:#fff; }
    .danger { background:#dc2626; color:#fff; }
    .status-badge { padding:4px 8px; border-radius:12px; font-size:12px; font-weight:500; }
    .status-pending { background:#fef3c7; color:#92400e; }
    .status-approved { background:#d1fae5; color:#065f46; }
    .status-rejected { background:#fecaca; color:#991b1b; }
    .payment-status { text-align:center; }
    .payment-badge { padding:2px 6px; border-radius:8px; font-size:11px; font-weight:500; }
    .payment-pending { background:#fef3c7; color:#92400e; }
    .payment-confirmed { background:#d1fae5; color:#065f46; }
    .payment-none { background:#f1f5f9; color:#64748b; }
  `]
})
export class StudentsComponent implements OnInit, OnDestroy {
  items = signal<StudentItem[]>([]);
  products = signal<ProductItem[]>([]);
  sales = signal<UserItem[]>([]);
  keyword = '';
  showModal = signal(false);
  error = signal('');
  uploadError = signal('');
  uploading = signal(false);
  form: StudentForm = this.blankForm();
  canDeleteStudents = false;
  canApprove = false;
  pendingStudents = signal<StudentItem[]>([]);
  editingStudent: StudentItem | null = null;
  private subscription?: Subscription;

  constructor(
    private studentService: StudentService,
    private productService: ProductService,
    private auth: AuthService,
    private userService: UserService,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit() {
    this.reload();
    this.loadProducts();
    this.loadSales();
    this.canDeleteStudents = true;
    this.canApprove = true;

    // Subscribe để tự động reload khi có payment được duyệt từ InvoicesComponent
    this.subscription = this.invoiceService.onPaymentConfirmed.subscribe(() => {
      this.reload();
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  pendingCount = computed(() => this.pendingStudents().length);

  getStatusClass(student: any): string {
    const status = student.approvalStatus || 'PENDING';
    return `status-${status.toLowerCase()}`;
  }

  getStatusText(student: any): string {
    const status = student.approvalStatus || 'PENDING';
    const statusMap = {
      'PENDING': 'Chờ duyệt',
      'APPROVED': 'Đã duyệt', 
      'REJECTED': 'Từ chối'
    };
    return statusMap[status as keyof typeof statusMap] || 'Chờ duyệt';
  }

  isPending(student: any): boolean {
    return (student.approvalStatus || 'PENDING') === 'PENDING';
  }

  getPaymentStatusClass(student: any, frameIndex: number): string {
    const payment = this.getPaymentFrame(student, frameIndex);
    if (!payment) return 'payment-none';
    const status = payment.confirmStatus || 'PENDING';
    return `payment-${status.toLowerCase()}`;
  }

  getPaymentStatusText(student: any, frameIndex: number): string {
    const payment = this.getPaymentFrame(student, frameIndex);
    if (!payment) return '-';
    const status = payment.confirmStatus || 'PENDING';
    const statusMap = {
      'PENDING': 'Chờ duyệt',
      'CONFIRMED': 'Đã duyệt'
    };
    return statusMap[status as keyof typeof statusMap] || 'Chờ duyệt';
  }

  private getPaymentFrame(student: any, frameIndex: number) {
    const payments = student.payments || [];
    return payments.find((p: any) => p.frameIndex === frameIndex);
  }

  async approve(studentId: string, action: 'APPROVE' | 'REJECT') {
    const userId = this.auth.userSignal()?.sub;
    if (!userId) return;

    const result = await this.studentService.approve(studentId, action, userId);
    if (result.ok) {
      this.reload();
      this.loadPendingStudents();
    } else {
      alert(result.message || 'Không thể thực hiện thao tác');
    }
  }

  async showPendingApproval() {
    await this.loadPendingStudents();
    // You can add a modal or navigate to a pending approval page here
  }

  async loadPendingStudents() {
    const data = await this.studentService.getPendingApproval();
    this.pendingStudents.set(data);
  }

  async clearAllData() {
    const confirmed = confirm('⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa TẤT CẢ dữ liệu học sinh, điểm danh và đơn hàng?\n\nThao tác này KHÔNG THỂ HOÀN TÁC!');
    if (!confirmed) return;

    const doubleConfirm = confirm('🚨 XÁC NHẬN LẦN CUỐI: Điều này sẽ xóa vĩnh viễn toàn bộ dữ liệu!\n\nNhấn OK để tiếp tục xóa tất cả.');
    if (!doubleConfirm) return;

    const result = await this.studentService.clearAllData();
    if (result.ok) {
      alert('✅ Đã xóa tất cả dữ liệu thành công!');
      this.reload();
      this.loadPendingStudents();
    } else {
      alert('❌ Lỗi: ' + (result.message || 'Không thể xóa dữ liệu'));
    }
  }

  filtered = computed(() => {
    const kw = this.keyword.trim().toLowerCase();
    if (!kw) return this.items();
    return this.items().filter((s) =>
      s.fullName.toLowerCase().includes(kw) ||
      s.studentCode.toLowerCase().includes(kw)
    );
  });

  async reload() {
    const data = await this.studentService.list();
    this.items.set(data);
  }

  async loadProducts() {
    const data = await this.productService.list();
    this.products.set(data);
  }

  async loadSales() {
    const data = await this.userService.listSales();
    this.sales.set(data);
  }

  openModal() {
    this.editingStudent = null;
    this.form = this.blankForm();
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  edit(student: StudentItem) {
    this.editingStudent = student;
    this.form = {
      studentCode: student.studentCode || '',
      fullName: student.fullName,
      age: student.age,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      faceImage: student.faceImage,
      productPackage: student.productPackage?._id || '',
      studentType: (student as any).studentType || '',
      saleId: (student as any).saleId || '',
      saleName: (student as any).saleName || '',
      invoiceImage: (student as any).invoiceImage || '',
      invoiceCode: (student as any).invoiceCode || '',
      sessionsRegistered: (student as any).sessionsRegistered ?? null,
      pricePerSession: (student as any).pricePerSession ?? null,
      amountCollected: (student as any).amountCollected ?? null,
      sessionsCollected: (student as any).sessionsCollected ?? null,
      confirmStatus: (student as any).confirmStatus || '',
      // Payment frames 2-10
      invoiceCode2: '', sessionsRegistered2: null, pricePerSession2: null, amountCollected2: null, sessionsCollected2: null, invoiceImage2: '', confirmStatus2: '',
      invoiceCode3: '', sessionsRegistered3: null, pricePerSession3: null, amountCollected3: null, sessionsCollected3: null, invoiceImage3: '', confirmStatus3: '',
      invoiceCode4: '', sessionsRegistered4: null, pricePerSession4: null, amountCollected4: null, sessionsCollected4: null, invoiceImage4: '', confirmStatus4: '',
      invoiceCode5: '', sessionsRegistered5: null, pricePerSession5: null, amountCollected5: null, sessionsCollected5: null, invoiceImage5: '', confirmStatus5: '',
      invoiceCode6: '', sessionsRegistered6: null, pricePerSession6: null, amountCollected6: null, sessionsCollected6: null, invoiceImage6: '', confirmStatus6: '',
      invoiceCode7: '', sessionsRegistered7: null, pricePerSession7: null, amountCollected7: null, sessionsCollected7: null, invoiceImage7: '', confirmStatus7: '',
      invoiceCode8: '', sessionsRegistered8: null, pricePerSession8: null, amountCollected8: null, sessionsCollected8: null, invoiceImage8: '', confirmStatus8: '',
      invoiceCode9: '', sessionsRegistered9: null, pricePerSession9: null, amountCollected9: null, sessionsCollected9: null, invoiceImage9: '', confirmStatus9: '',
      invoiceCode10: '', sessionsRegistered10: null, pricePerSession10: null, amountCollected10: null, sessionsCollected10: null, invoiceImage10: '', confirmStatus10: '',
      approvalStatus: (student as any).approvalStatus || 'PENDING',
    };
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  async submit() {
    const payload: any = {
      studentCode: this.form.studentCode.trim(),
      fullName: this.form.fullName.trim(),
      age: Number(this.form.age),
      parentName: this.form.parentName.trim(),
      parentPhone: this.form.parentPhone.trim(),
      faceImage: this.form.faceImage.trim(),
    };

    // optional fields
    if (this.form.productPackage) payload.productPackage = this.form.productPackage;
    if (this.form.studentType) payload.studentType = this.form.studentType;
    if (this.form.saleId) payload.saleId = this.form.saleId;
    if (this.form.saleName) payload.saleName = this.form.saleName;

    // Build payments array from all 10 payment frames
    const payments: any[] = [];
    for (let i = 1; i <= 10; i++) {
      const invoiceCode = this.form[`invoiceCode${i === 1 ? '' : i}` as keyof StudentForm] as string;
      const sessionsRegistered = this.form[`sessionsRegistered${i === 1 ? '' : i}` as keyof StudentForm] as number | null;
      const pricePerSession = this.form[`pricePerSession${i === 1 ? '' : i}` as keyof StudentForm] as number | null;
      const amountCollected = this.form[`amountCollected${i === 1 ? '' : i}` as keyof StudentForm] as number | null;
      const sessionsCollected = this.form[`sessionsCollected${i === 1 ? '' : i}` as keyof StudentForm] as number | null;
      const invoiceImage = this.form[`invoiceImage${i === 1 ? '' : i}` as keyof StudentForm] as string;
      const confirmStatus = this.form[`confirmStatus${i === 1 ? '' : i}` as keyof StudentForm] as string;

      // Only add payment frame if at least one field has data
      if (invoiceCode || sessionsRegistered != null || pricePerSession != null || amountCollected != null || 
          sessionsCollected != null || invoiceImage) {
        const paymentFrame: any = { 
          frameIndex: i,
          confirmStatus: 'PENDING' // Always start as pending
        };
        if (invoiceCode) paymentFrame.invoiceCode = invoiceCode.trim();
        if (sessionsRegistered != null) paymentFrame.sessionsRegistered = Number(sessionsRegistered);
        if (pricePerSession != null) paymentFrame.pricePerSession = Number(pricePerSession);
        if (amountCollected != null) paymentFrame.amountCollected = Number(amountCollected);
        if (sessionsCollected != null) paymentFrame.sessionsCollected = Number(sessionsCollected);
        if (invoiceImage) paymentFrame.invoiceImage = invoiceImage;
        payments.push(paymentFrame);
      }
    }
    
    if (payments.length > 0) payload.payments = payments;

    let result;
    if (this.editingStudent) {
      result = await this.studentService.update(this.editingStudent._id, payload);
      if (!result.ok) {
        this.error.set(result.message || 'Không thể cập nhật học sinh');
        return;
      }
    } else {
      result = await this.studentService.create(payload);
      if (!result.ok) {
        this.error.set(result.message || 'Không thể tạo học sinh');
        return;
      }
    }

    this.closeModal();
    this.reload();
  }

  async handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set('');
    this.uploading.set(true);
    const result = await this.studentService.uploadFace(file);
    this.uploading.set(false);

    if (!result.ok || !result.url) {
      this.uploadError.set(result.message || 'Tải ảnh thất bại');
      return;
    }

    this.form.faceImage = result.url;
  }

  async handleReceiptUpload(event: Event, frameIndex: number = 1) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const result = await this.invoiceService.uploadReceipt(file);
    if (!result.ok || !result.url) {
      this.uploadError.set(result.message || 'Tải ảnh hóa đơn thất bại');
      return;
    }
    
    // Set the appropriate invoice image field based on frameIndex
    if (frameIndex === 1) this.form.invoiceImage = result.url;
    else if (frameIndex === 2) this.form.invoiceImage2 = result.url;
    else if (frameIndex === 3) this.form.invoiceImage3 = result.url;
    else if (frameIndex === 4) this.form.invoiceImage4 = result.url;
    else if (frameIndex === 5) this.form.invoiceImage5 = result.url;
    else if (frameIndex === 6) this.form.invoiceImage6 = result.url;
    else if (frameIndex === 7) this.form.invoiceImage7 = result.url;
    else if (frameIndex === 8) this.form.invoiceImage8 = result.url;
    else if (frameIndex === 9) this.form.invoiceImage9 = result.url;
    else if (frameIndex === 10) this.form.invoiceImage10 = result.url;
  }

  onSaleChange(saleId: string) {
    if (!saleId) {
      this.form.saleName = '';
      return;
    }
    const u = this.sales().find(s => s._id === saleId);
    this.form.saleName = u?.fullName || '';
  }

  async remove(student: StudentItem) {
    if (!confirm(`Xóa học sinh ${student.fullName}?`)) return;
    try {
      console.log('Deleting student:', student._id);
      const result = await this.studentService.remove(student._id);
      console.log('Delete result:', result);
      if (!result.ok) {
        console.error('Delete failed:', result);
        alert(result.message || 'Không thể xóa học sinh');
        return;
      }
      
      // Remove from local list immediately
      const currentItems = this.items();
      const updatedItems = currentItems.filter(s => s._id !== student._id);
      this.items.set(updatedItems);
      
      // Also reload from server to ensure consistency
      const freshData = await this.studentService.list();
      this.items.set(freshData);
      
      alert(`Đã xóa học sinh ${student.fullName} thành công!`);
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Lỗi khi xóa học sinh: ' + error);
    }
  }

  private blankForm(): StudentForm {
    return {
      studentCode: '',
      fullName: '',
      age: 6,
      parentName: '',
      parentPhone: '',
      faceImage: '',
      productPackage: '',
      studentType: '',
      saleId: '',
      saleName: '',
      invoiceImage: '',
      invoiceCode: '',
      sessionsRegistered: null,
      pricePerSession: null,
      amountCollected: null,
      sessionsCollected: null,
      confirmStatus: '',
      // Payment frames 2-10
      invoiceCode2: '', sessionsRegistered2: null, pricePerSession2: null, amountCollected2: null, sessionsCollected2: null, invoiceImage2: '', confirmStatus2: '',
      invoiceCode3: '', sessionsRegistered3: null, pricePerSession3: null, amountCollected3: null, sessionsCollected3: null, invoiceImage3: '', confirmStatus3: '',
      invoiceCode4: '', sessionsRegistered4: null, pricePerSession4: null, amountCollected4: null, sessionsCollected4: null, invoiceImage4: '', confirmStatus4: '',
      invoiceCode5: '', sessionsRegistered5: null, pricePerSession5: null, amountCollected5: null, sessionsCollected5: null, invoiceImage5: '', confirmStatus5: '',
      invoiceCode6: '', sessionsRegistered6: null, pricePerSession6: null, amountCollected6: null, sessionsCollected6: null, invoiceImage6: '', confirmStatus6: '',
      invoiceCode7: '', sessionsRegistered7: null, pricePerSession7: null, amountCollected7: null, sessionsCollected7: null, invoiceImage7: '', confirmStatus7: '',
      invoiceCode8: '', sessionsRegistered8: null, pricePerSession8: null, amountCollected8: null, sessionsCollected8: null, invoiceImage8: '', confirmStatus8: '',
      invoiceCode9: '', sessionsRegistered9: null, pricePerSession9: null, amountCollected9: null, sessionsCollected9: null, invoiceImage9: '', confirmStatus9: '',
      invoiceCode10: '', sessionsRegistered10: null, pricePerSession10: null, amountCollected10: null, sessionsCollected10: null, invoiceImage10: '', confirmStatus10: '',
      approvalStatus: '',
    };
  }
}
