import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';

interface AttendanceInfo {
  _id: string;
  studentId: {
    _id: string;
    fullName: string;
    age: number;
    parentName: string;
  };
  classId: {
    _id: string;
    name: string;
    code: string;
  };
  teacherId: {
    _id: string;
    fullName: string;
    email: string;
  };
  date: string;
  status: string;
}

@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="student-attendance-container">
      <div class="attendance-header">
        <h1>Điểm danh học sinh</h1>
      </div>

      <div *ngIf="loading()" class="loading">
        <div class="spinner"></div>
        <p>Đang tải thông tin...</p>
      </div>

      <div *ngIf="error()" class="error-message">
        <h2>❌ {{ error() }}</h2>
        <p>Vui lòng liên hệ giáo viên để được hỗ trợ.</p>
      </div>

      <div *ngIf="!loading() && !error() && !submitted()" class="attendance-content">
        <div class="info-card">
          <h2>Thông tin điểm danh</h2>
          <div class="info-row">
          <span class="label">Học sinh:</span>
          <span class="value">{{ attendanceInfo()?.studentId?.fullName }}</span>
          </div>
          <div class="info-row">
          <span class="label">Lớp:</span>
          <span class="value">{{ attendanceInfo()?.classId?.code }} - {{ attendanceInfo()?.classId?.name }}</span>
          </div>
          <div class="info-row">
          <span class="label">Giáo viên:</span>
          <span class="value">{{ attendanceInfo()?.teacherId?.fullName }}</span>
          </div>
          <div class="info-row">
            <span class="label">Ngày:</span>
            <span class="value">{{ formatDate(attendanceInfo()?.date) }}</span>
          </div>
        </div>

        <div class="webcam-section">
          <h3>Camera</h3>
          <div class="video-container">
            <video #videoElement autoplay playsinline></video>
            <canvas #canvasElement style="display: none;"></canvas>
          </div>
          
          <div *ngIf="!cameraStarted()" class="camera-controls">
            <button class="btn btn-primary" (click)="startCamera()">
              📷 Bật camera
            </button>
          </div>

          <div *ngIf="cameraStarted() && !capturedImage()" class="camera-controls">
            <button class="btn btn-success" (click)="captureAndSubmit()">
              ✅ Điểm danh ngay
            </button>
          </div>

          <div *ngIf="capturedImage()" class="preview-section">
            <h3>Ảnh đã chụp</h3>
            <img [src]="capturedImage()" alt="Captured" />
            <p class="submitting-text">Đang gửi điểm danh...</p>
          </div>
        </div>
      </div>

      <div *ngIf="submitted()" class="success-message">
        <div class="success-icon">✅</div>
        <h2>Điểm danh thành công!</h2>
        <p>Cảm ơn bạn đã điểm danh. Thông tin đã được ghi nhận.</p>
        <div class="submitted-info">
          <p><strong>Thời gian:</strong> {{ formatDateTime(submittedAt()) }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .student-attendance-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .attendance-header {
      text-align: center;
      color: white;
      margin-bottom: 2rem;
    }

    .attendance-header h1 {
      font-size: 2.5rem;
      margin: 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }

    .loading, .error-message, .success-message {
      background: white;
      padding: 3rem;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
      width: 100%;
    }

    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-message {
      background: #fff5f5;
      border: 2px solid #fc8181;
    }

    .error-message h2 {
      color: #c53030;
      margin: 0 0 1rem;
    }

    .attendance-content {
      background: white;
      padding: 2rem;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 800px;
      width: 100%;
    }

    .info-card {
      background: #f7fafc;
      padding: 1.5rem;
      border-radius: 12px;
      margin-bottom: 2rem;
    }

    .info-card h2 {
      margin: 0 0 1rem;
      color: #2d3748;
      font-size: 1.5rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 600;
      color: #4a5568;
    }

    .value {
      color: #2d3748;
      font-weight: 500;
    }

    .webcam-section {
      text-align: center;
    }

    .webcam-section h3 {
      color: #2d3748;
      margin-bottom: 1rem;
    }

    .video-container {
      position: relative;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
      max-width: 640px;
      margin-left: auto;
      margin-right: auto;
    }

    video {
      width: 100%;
      height: auto;
      display: block;
    }

    .camera-controls {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 1rem;
    }

    .btn {
      padding: 1rem 2rem;
      font-size: 1.125rem;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.15);
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-success {
      background: #48bb78;
      color: white;
      font-size: 1.5rem;
      padding: 1.5rem 3rem;
    }

    .preview-section {
      margin-top: 2rem;
    }

    .preview-section img {
      max-width: 100%;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 1rem;
    }

    .submitting-text {
      color: #4a5568;
      font-style: italic;
    }

    .success-message {
      background: #f0fff4;
      border: 2px solid #48bb78;
    }

    .success-icon {
      font-size: 5rem;
      margin-bottom: 1rem;
    }

    .success-message h2 {
      color: #2f855a;
      margin: 0 0 1rem;
    }

    .submitted-info {
      margin-top: 1.5rem;
      padding: 1rem;
      background: white;
      border-radius: 8px;
    }
  `]
})
export class StudentAttendanceComponent implements OnInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  loading = signal(true);
  error = signal('');
  attendanceInfo = signal<AttendanceInfo | null>(null);
  cameraStarted = signal(false);
  capturedImage = signal('');
  submitted = signal(false);
  submittedAt = signal<Date | null>(null);

  private token = '';
  private stream: MediaStream | null = null;

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    
    if (!this.token) {
      this.error.set('Link không hợp lệ');
      this.loading.set(false);
      return;
    }

    await this.loadAttendanceInfo();
  }

  async loadAttendanceInfo() {
    try {
      const response = await fetch(`${environment.apiBase}/public/attendance/token/${this.token}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Không thể tải thông tin điểm danh');
      }

      const data = await response.json();
      this.attendanceInfo.set(data);
      this.loading.set(false);
    } catch (error: any) {
      this.error.set(error.message || 'Có lỗi xảy ra khi tải thông tin');
      this.loading.set(false);
    }
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      this.videoElement.nativeElement.srcObject = this.stream;
      this.cameraStarted.set(true);
    } catch (error) {
      this.error.set('Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera.');
    }
  }

  async captureAndSubmit() {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    
    // Giảm kích thước ảnh xuống tối đa 800px width để giảm dung lượng
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Nén ảnh ở mức 50% chất lượng - vừa đủ rõ nét và dung lượng hợp lý
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.5);
      this.capturedImage.set(imageBase64);
      
      // Stop camera
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      
      // Submit attendance
      await this.submitAttendance(imageBase64);
    }
  }

  async submitAttendance(imageBase64: string) {
    try {
      const response = await fetch(`${environment.apiBase}/public/attendance/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: this.token,
          imageBase64
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Không thể gửi điểm danh');
      }

      const data = await response.json();
      this.submitted.set(true);
      this.submittedAt.set(new Date());
    } catch (error: any) {
      this.error.set(error.message || 'Có lỗi xảy ra khi gửi điểm danh');
      this.capturedImage.set(''); // Reset to allow retry
      this.cameraStarted.set(false);
    }
  }

  formatDate(dateStr: any): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  formatDateTime(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  ngOnDestroy() {
    // Clean up camera stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}
