import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StudentItem, StudentService } from '../services/student.service';
import { UserItem, UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';

interface StudentForm {
  studentCode: string;
  fullName: string;
  age: number;
  studentBirthMonth: number | null;
  parentBirthMonth: number | null;
  parentUserId: string;
  parentName: string;
  parentPhone: string;
  paymentCount: number;
  faceImage: string;
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-header">
      <div>
        <h2>Quan ly hoc sinh</h2>
        <p>Theo doi thong tin phu huynh va anh nhan dien.</p>
      </div>
      <button class="primary" (click)="openModal()">+ Them hoc sinh</button>
    </header>

    <section class="filters">
      <input placeholder="Tim theo ten hoac ma hoc sinh" [(ngModel)]="keyword" />
      <button (click)="reload()">Lam moi</button>
    </section>

    <table class="data" *ngIf="filtered().length; else empty">
      <thead>
        <tr>
          <th>Anh</th>
          <th>Ma hoc sinh</th>
          <th>Ho va ten</th>
          <th>Tuoi</th>
          <th>Thang sinh HS</th>
          <th>Ten phu huynh</th>
          <th>Thang sinh PH</th>
          <th>Dien thoai</th>
          <th>So lan TT</th>
          <th>Hanh dong</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let s of filtered()">
          <td><img [src]="s.faceImage" alt="{{s.fullName}}" /></td>
          <td><strong>{{s.studentCode}}</strong></td>
          <td>{{s.fullName}}</td>
          <td>{{s.age}}</td>
          <td>{{ s.studentBirthMonth ? 'T' + s.studentBirthMonth : '-' }}</td>
          <td>{{s.parentName}}</td>
          <td>{{ s.parentBirthMonth ? 'T' + s.parentBirthMonth : '-' }}</td>
          <td>{{s.parentPhone}}</td>
          <td>{{ s.payments?.length || 0 }}</td>
          <td class="actions-cell">
            <button class="ghost" (click)="edit(s)">Sua</button>
            <button class="ghost" (click)="remove(s)" *ngIf="canDeleteStudents">Xoa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #empty><p>Chua co hoc sinh.</p></ng-template>

    <div class="modal-backdrop" *ngIf="showModal()">
      <div class="modal">
        <h3>{{ editingStudent ? 'Sua hoc sinh' : 'Them hoc sinh' }}</h3>
        <form (ngSubmit)="submit()">
          <label>Ma hoc sinh
            <input name="studentCode" [(ngModel)]="form.studentCode" placeholder="Vi du: HS001" required />
          </label>
          <label>Ho va ten
            <input name="fullName" [(ngModel)]="form.fullName" required />
          </label>
          <label>Tuoi
            <input name="age" type="number" min="3" max="25" [(ngModel)]="form.age" required />
          </label>
          <label>Thang sinh hoc sinh
            <select name="studentBirthMonth" [(ngModel)]="form.studentBirthMonth">
              <option [ngValue]="null">-- Chon thang --</option>
              <option *ngFor="let m of monthOptions" [ngValue]="m">Thang {{ m }}</option>
            </select>
          </label>
          <label>Ma phu huynh
            <select name="parentUserId" [(ngModel)]="form.parentUserId" (ngModelChange)="onParentChange($event)">
              <option value="">-- Chon ma phu huynh --</option>
              <option *ngFor="let p of parents()" [value]="p._id">
                {{ p.userCode || 'N/A' }} - {{ p.fullName }}
              </option>
            </select>
          </label>
          <label>Ten phu huynh
            <input
              name="parentName"
              [(ngModel)]="form.parentName"
              required />
          </label>
          <label>Thang sinh phu huynh
            <select name="parentBirthMonth" [(ngModel)]="form.parentBirthMonth">
              <option [ngValue]="null">-- Chon thang --</option>
              <option *ngFor="let m of monthOptions" [ngValue]="m">Thang {{ m }}</option>
            </select>
          </label>
          <label>Dien thoai phu huynh
            <input
              name="parentPhone"
              [(ngModel)]="form.parentPhone"
              required />
          </label>
          <label>So lan thanh toan
            <input
              name="paymentCount"
              type="number"
              min="0"
              max="10"
              [(ngModel)]="form.paymentCount"
              [disabled]="!!editingStudent"
              required />
          </label>
          <small *ngIf="editingStudent">So lan thanh toan chi ap dung khi tao moi hoc sinh.</small>
          <label>Anh nhan dien
            <input type="file" accept="image/*" (change)="handleFileChange($event)" />
          </label>
          <div class="upload-status">
            <span *ngIf="uploading()">Dang tai anh...</span>
            <span class="error" *ngIf="uploadError()">{{uploadError()}}</span>
            <img *ngIf="form.faceImage && !uploading()" [src]="form.faceImage" alt="Xem truoc" class="preview" />
          </div>
          <div class="actions">
            <button type="submit" class="primary" [disabled]="uploading() || !form.faceImage">Luu</button>
            <button type="button" (click)="closeModal()">Huy</button>
          </div>
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
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:360px; box-shadow:0 8px 24px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { width:120px; text-align:right; }
    .actions-cell button { margin-left:4px; }
    .error { color:#dc2626; }
    .upload-status { display:flex; flex-direction:column; gap:6px; font-size:13px; }
    .preview { width:120px; height:120px; object-fit:cover; border-radius:8px; border:1px solid #cbd5f5; }
  `]
})
export class StudentsComponent {
  items = signal<StudentItem[]>([]);
  parents = signal<UserItem[]>([]);
  keyword = '';
  showModal = signal(false);
  error = signal('');
  uploadError = signal('');
  uploading = signal(false);
  form: StudentForm = this.blankForm();
  canDeleteStudents = false;
  editingStudent: StudentItem | null = null;
  monthOptions = [1,2,3,4,5,6,7,8,9,10,11,12];

  constructor(
    private studentService: StudentService,
    private userService: UserService,
    private auth: AuthService
  ) {
    this.reload();
    this.loadParents();
    this.canDeleteStudents = this.auth.userSignal()?.role === 'DIRECTOR';
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

  async loadParents() {
    const data = await this.userService.listParents();
    const parentData = data
      .filter((u) => u.role === 'PARENT')
      .sort((a, b) => {
        const aCode = (a.userCode || '').trim();
        const bCode = (b.userCode || '').trim();
        if (aCode && bCode) return aCode.localeCompare(bCode);
        if (aCode) return -1;
        if (bCode) return 1;
        return a.fullName.localeCompare(b.fullName);
      });
    this.parents.set(parentData);
  }

  onParentChange(parentId: string) {
    if (!parentId) {
      this.form.parentName = '';
      this.form.parentPhone = '';
      return;
    }
    const selectedParent = this.parents().find((p) => p._id === parentId);
    if (!selectedParent) return;
    this.form.parentName = selectedParent.fullName || '';
    this.form.parentPhone = selectedParent.phone || '';
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
      studentBirthMonth: student.studentBirthMonth || null,
      parentBirthMonth: student.parentBirthMonth || null,
      parentUserId: student.parentUserId || '',
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      paymentCount: student.payments?.length || 0,
      faceImage: student.faceImage,
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

    if (this.form.parentUserId) {
      payload.parentUserId = this.form.parentUserId;
    }
    if (this.form.studentBirthMonth) {
      payload.studentBirthMonth = Number(this.form.studentBirthMonth);
    }
    if (this.form.parentBirthMonth) {
      payload.parentBirthMonth = Number(this.form.parentBirthMonth);
    }

    if (!this.editingStudent) {
      const paymentCount = Number(this.form.paymentCount || 0);
      if (paymentCount > 0) {
        payload.payments = Array.from({ length: paymentCount }, (_, i) => ({
          frameIndex: i + 1,
          confirmStatus: 'PENDING',
        }));
      }
    }

    try {
      if (this.editingStudent) {
        await this.studentService.update(this.editingStudent._id, payload);
      } else {
        await this.studentService.create(payload);
      }
      this.closeModal();
      this.reload();
    } catch (e: any) {
      this.error.set(e?.message || 'Khong the luu hoc sinh');
    }
  }

  async handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set('');
    this.uploading.set(true);
    try {
      const result = await this.studentService.uploadFace(file);
      this.uploading.set(false);
      if (!result.url) {
        this.uploadError.set('Tai anh that bai');
        return;
      }
      this.form.faceImage = result.url;
    } catch (e: any) {
      this.uploading.set(false);
      this.uploadError.set(e?.message || 'Tai anh that bai');
    }
  }

  async remove(student: StudentItem) {
    if (!confirm(`Xoa hoc sinh ${student.fullName}?`)) return;
    try {
      await this.studentService.remove(student._id);
      this.reload();
    } catch (e: any) {
      alert(e?.message || 'Khong the xoa hoc sinh');
    }
  }

  private blankForm(): StudentForm {
    return {
      studentCode: '',
      fullName: '',
      age: 6,
      studentBirthMonth: null,
      parentBirthMonth: null,
      parentUserId: '',
      parentName: '',
      parentPhone: '',
      paymentCount: 0,
      faceImage: '',
    };
  }
}
