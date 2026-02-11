/**
 * SEED SCRIPT: Teaching Reports
 * 
 * Tạo dữ liệu mẫu cho chức năng báo cáo giảng dạy
 * Bao gồm các case:
 * - Báo cáo đầy đủ (best practice)
 * - Báo cáo tối thiểu (chỉ lessonContent)
 * - Sessions chưa nộp báo cáo (pending)
 * - Sessions đã finalized chưa có báo cáo (at risk for payroll)
 * 
 * Usage: node scripts/seed-teaching-reports.js
 */

const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/school-mgmt';

// Schemas
const SessionSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  parentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scheduledDate: Date,
  durationMinutes: Number,
  status: String,
  teacherPayout: Number,
  isTeacherPaid: Boolean,
  hasTeachingReport: Boolean,
  teachingReport: {
    lessonContent: String,
    studentAttitude: String,
    recordingUrl: String,
    teacherComment: String,
    homework: String,
    additionalNotes: String,
    submittedAt: Date,
  },
  confirmation: {
    teacherConfirmedAt: Date,
    parentConfirmedAt: Date,
    finalizedAt: Date,
    finalizedBy: mongoose.Schema.Types.ObjectId,
  },
}, { timestamps: true });

const Session = mongoose.model('Session', SessionSchema);

// Sample data
async function seedTeachingReports() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Lấy các IDs từ database (giả sử đã có users/teachers/students/classes)
    console.log('\n📦 Fetching existing data...');
    const User = mongoose.model('User');
    const Teacher = mongoose.model('Teacher');
    const Student = mongoose.model('Student');
    const Class = mongoose.model('Class');

    const teachers = await Teacher.find().limit(3);
    const students = await Student.find().limit(5);
    const classes = await Class.find().limit(3);
    const parents = await User.find({ role: 'PARENT' }).limit(3);

    if (!teachers.length || !students.length || !classes.length) {
      console.error('❌ Không tìm thấy dữ liệu teachers/students/classes. Hãy chạy seed-users.js trước.');
      process.exit(1);
    }

    console.log(`Found: ${teachers.length} teachers, ${students.length} students, ${classes.length} classes`);

    // Clear existing sessions (optional)
    console.log('\n🗑️  Clearing existing sessions...');
    await Session.deleteMany({});

    // Tạo sessions
    console.log('\n📝 Creating sample sessions with teaching reports...\n');

    const sessions = [
      // ===== CASE 1: Báo cáo đầy đủ (BEST PRACTICE) =====
      {
        classId: classes[0]._id,
        studentId: students[0]._id,
        teacherId: teachers[0]._id,
        parentUserId: parents[0]?._id,
        scheduledDate: new Date('2026-02-09T14:00:00Z'),
        durationMinutes: 90,
        status: 'FINALIZED',
        teacherPayout: 270000,
        isTeacherPaid: false,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: `Chương 3: Phân số - Bài 1: Khái niệm phân số

Nội dung chính:
- Giới thiệu phân số qua ví dụ thực tế (chia bánh, chia táo)
- Phân biệt tử số và mẫu số
- Cách đọc và viết phân số
- So sánh phân số với số nguyên

Hoạt động trong lớp:
- Học sinh làm bài tập trên bảng (3/5 làm đúng)
- Chơi game "Tìm phân số" với flashcards
- Thảo luận nhóm về phân số trong đời sống

Kết quả:
- 90% học sinh nắm vững khái niệm
- 10% cần bài tập thêm về cách viết phân số`,
          
          studentAttitude: `Học sinh rất tích cực và hào hứng trong giờ học.

Điểm mạnh:
- Chú ý lắng nghe, không bị phân tâm
- Tham gia trả lời câu hỏi nhiệt tình
- Làm bài tập đúng 8/10 câu

Điểm cần cải thiện:
- Hơi lúng túng với bài tập cuối buổi (phân số hỗn hợp)
- Sau khi giải thích thêm đã hiểu, nhưng cần luyện tập thêm

Tổng quan: Tiến bộ rõ rệt so với buổi trước. Nếu duy trì được thái độ này, em sẽ học rất tốt môn Toán.`,
          
          recordingUrl: 'https://drive.google.com/file/d/1abc123xyz456def/view',
          
          teacherComment: `Em Nguyễn Văn A là học sinh xuất sắc trong lớp.

Ưu điểm:
- Tư duy logic tốt, tiếp thu kiến thức nhanh
- Không ngại đặt câu hỏi khi chưa hiểu
- Giúp đỡ bạn trong hoạt động nhóm

Khuyến nghị:
- Nên làm thêm 5-10 bài tập nâng cao về nhà để củng cố
- Có thể tham gia Olympic Toán cấp trường
- Buổi sau sẽ học về "So sánh phân số", em cần ôn lại phần khái niệm

Mong phụ huynh tiếp tục động viên và theo dõi quá trình học của em.`,
          
          homework: `SGK Toán 5:
- Trang 45: Bài tập 1, 2, 3 (Nhận biết phân số)
- Trang 46: Bài tập 4, 5 (Viết phân số từ hình vẽ)

SBT (Sách bài tập):
- Trang 28: Bài 1-5 (Củng cố khái niệm)
- Trang 29: Bài 7 (Nâng cao - tự chọn)

Deadline: Trước buổi học tiếp theo (12/02/2026)

Lưu ý: Nếu gặp khó khăn, em có thể nhắn tin cho cô qua Zalo hoặc hỏi lại trong buổi học sau.`,
          
          additionalNotes: `Ghi chú thêm:
- Phụ huynh có thể xem video ghi hình để theo dõi chi tiết buổi học
- Em học rất tập trung trong suốt 90 phút, không mệt mỏi
- Đề xuất: Buổi học sau có thể tăng độ khó lên một chút
- Cô đã gửi thêm tài liệu ôn tập vào email phụ huynh
- Reminder: Tuần sau sẽ có kiểm tra 15 phút về chương này`,
          
          submittedAt: new Date('2026-02-09T16:30:00Z'),
        },
        confirmation: {
          teacherConfirmedAt: new Date('2026-02-09T15:30:00Z'),
          parentConfirmedAt: new Date('2026-02-09T15:45:00Z'),
          finalizedAt: new Date('2026-02-09T16:00:00Z'),
          finalizedBy: parents[0]?._id,
        },
      },

      // ===== CASE 2: Báo cáo tối thiểu (CHỈ LESONCONTENT) =====
      {
        classId: classes[1]._id,
        studentId: students[1]._id,
        teacherId: teachers[1]._id,
        parentUserId: parents[1]?._id,
        scheduledDate: new Date('2026-02-08T16:00:00Z'),
        durationMinutes: 60,
        status: 'TEACHER_COMPLETED',
        teacherPayout: 180000,
        isTeacherPaid: false,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: 'Unit 5: Grammar - Present Perfect Tense. Exercises 1-10 from workbook page 32.',
          submittedAt: new Date('2026-02-08T17:15:00Z'),
        },
        confirmation: {
          teacherConfirmedAt: new Date('2026-02-08T17:00:00Z'),
        },
      },

      // ===== CASE 3: Báo cáo đầy đủ nhưng chất lượng thấp =====
      {
        classId: classes[0]._id,
        studentId: students[2]._id,
        teacherId: teachers[0]._id,
        parentUserId: parents[2]?._id,
        scheduledDate: new Date('2026-02-07T10:00:00Z'),
        durationMinutes: 60,
        status: 'FINALIZED',
        teacherPayout: 180000,
        isTeacherPaid: false,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: 'Học bài 5. Làm bài tập.',
          studentAttitude: 'Học tốt.',
          teacherComment: 'Ok.',
          homework: 'Bài tập trang 20.',
          submittedAt: new Date('2026-02-07T11:30:00Z'),
        },
        confirmation: {
          teacherConfirmedAt: new Date('2026-02-07T11:00:00Z'),
          parentConfirmedAt: new Date('2026-02-07T11:15:00Z'),
          finalizedAt: new Date('2026-02-07T11:20:00Z'),
          finalizedBy: parents[2]?._id,
        },
      },

      // ===== CASE 4: Session FINALIZED nhưng CHƯA NỘP BÁO CÁO (AT RISK) =====
      {
        classId: classes[2]._id,
        studentId: students[3]._id,
        teacherId: teachers[2]._id,
        parentUserId: parents[0]?._id,
        scheduledDate: new Date('2026-02-06T09:00:00Z'),
        durationMinutes: 120,
        status: 'FINALIZED',
        teacherPayout: 360000,
        isTeacherPaid: false,
        hasTeachingReport: false,  // ← RISK: Không được tính lương
        teachingReport: null,
        confirmation: {
          teacherConfirmedAt: new Date('2026-02-06T11:00:00Z'),
          parentConfirmedAt: new Date('2026-02-06T11:30:00Z'),
          finalizedAt: new Date('2026-02-06T12:00:00Z'),
          finalizedBy: parents[0]?._id,
        },
      },

      // ===== CASE 5: Session TEACHER_COMPLETED chưa nộp báo cáo (PENDING) =====
      {
        classId: classes[1]._id,
        studentId: students[4]._id,
        teacherId: teachers[1]._id,
        parentUserId: parents[1]?._id,
        scheduledDate: new Date('2026-02-10T14:00:00Z'),
        durationMinutes: 90,
        status: 'TEACHER_COMPLETED',
        teacherPayout: 270000,
        isTeacherPaid: false,
        hasTeachingReport: false,
        teachingReport: null,
        confirmation: {
          teacherConfirmedAt: new Date('2026-02-10T15:30:00Z'),
        },
      },

      // ===== CASE 6: Session CÓ RECORDING URL =====
      {
        classId: classes[0]._id,
        studentId: students[0]._id,
        teacherId: teachers[0]._id,
        parentUserId: parents[0]?._id,
        scheduledDate: new Date('2026-02-11T16:00:00Z'),
        durationMinutes: 60,
        status: 'PARENT_CONFIRMED',
        teacherPayout: 180000,
        isTeacherPaid: false,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: `Chương 4: Phân số bằng nhau

Kiến thức:
- Định nghĩa phân số bằng nhau
- Tính chất cơ bản của phân số
- Quy đồng mẫu số

Bài tập trong lớp: 5/7 bài đúng`,
          
          studentAttitude: 'Học sinh tích cực, chăm chú. Có tiến bộ về tốc độ làm bài.',
          
          recordingUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          
          teacherComment: 'Em học tốt. Cần luyện thêm về phân số tối giản.',
          
          homework: 'SGK trang 48-50, bài 1-6. SBT trang 30, bài 1-4.',
          
          submittedAt: new Date('2026-02-11T17:20:00Z'),
        },
        confirmation: {
          teacherConfirmedAt: new Date('2026-02-11T17:00:00Z'),
          parentConfirmedAt: new Date('2026-02-11T17:15:00Z'),
        },
      },

      // ===== CASE 7: Session bị HỦY (Không thể nộp báo cáo) =====
      {
        classId: classes[1]._id,
        studentId: students[1]._id,
        teacherId: teachers[1]._id,
        parentUserId: parents[1]?._id,
        scheduledDate: new Date('2026-02-05T10:00:00Z'),
        durationMinutes: 60,
        status: 'CANCELLED',
        teacherPayout: 0,
        isTeacherPaid: false,
        hasTeachingReport: false,
        teachingReport: null,
        cancellation: {
          cancelledAt: new Date('2026-02-05T08:00:00Z'),
          cancelledBy: parents[1]?._id,
          reason: 'Học sinh bị ốm, không thể tham gia buổi học',
          refundAmount: 150000,
        },
      },

      // ===== CASE 8: Báo cáo được NỘP MUỘN (submission delay > 48h) =====
      {
        classId: classes[2]._id,
        studentId: students[2]._id,
        teacherId: teachers[2]._id,
        parentUserId: parents[2]?._id,
        scheduledDate: new Date('2026-02-01T09:00:00Z'),
        durationMinutes: 90,
        status: 'FINALIZED',
        teacherPayout: 270000,
        isTeacherPaid: false,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: `Chương 2: Hình học không gian

Nội dung: Thể tích hình hộp chữ nhật
- Công thức tính thể tích: V = a × b × c
- Ví dụ minh họa
- Bài tập ứng dụng`,
          
          studentAttitude: 'Học sinh học tập nghiêm túc.',
          
          teacherComment: 'Em cần ôn lại công thức và làm thêm bài tập.',
          
          homework: 'SGK trang 35, bài 1-4.',
          
          submittedAt: new Date('2026-02-05T10:00:00Z'),  // ← 4 ngày sau finalizedAt!
        },
        confirmation: {
          teacherConfirmedAt: new Date('2026-02-01T10:30:00Z'),
          parentConfirmedAt: new Date('2026-02-01T11:00:00Z'),
          finalizedAt: new Date('2026-02-01T12:00:00Z'),
          finalizedBy: parents[2]?._id,
        },
      },

      // ===== CASE 9: Session SCHEDULED (chưa diễn ra) =====
      {
        classId: classes[0]._id,
        studentId: students[3]._id,
        teacherId: teachers[0]._id,
        parentUserId: parents[0]?._id,
        scheduledDate: new Date('2026-02-15T14:00:00Z'),  // Ngày mai
        durationMinutes: 60,
        status: 'SCHEDULED',
        teacherPayout: 180000,
        isTeacherPaid: false,
        hasTeachingReport: false,
        teachingReport: null,
      },

      // ===== CASE 10: Báo cáo với nhiều ghi chú thêm =====
      {
        classId: classes[1]._id,
        studentId: students[4]._id,
        teacherId: teachers[1]._id,
        parentUserId: parents[1]?._id,
        scheduledDate: new Date('2026-02-12T10:00:00Z'),
        durationMinutes: 90,
        status: 'FINALIZED',
        teacherPayout: 270000,
        isTeacherPaid: false,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: `Unit 6: Vocabulary - Family & Relationships

Topics covered:
- Family members vocabulary (23 new words)
- Describing family relationships
- Using possessive pronouns (my, your, his, her)
- Practice dialogues

Activities:
- Flashcard game (team competition)
- Drawing family tree
- Role-play: Introducing family members

Results: Student mastered 20/23 words. Needs to review "cousin", "niece", "nephew".`,
          
          studentAttitude: `Excellent attitude throughout the lesson.

Strengths:
- Active participation in games
- Good pronunciation
- Helped classmates
- Completed all activities on time

Areas for improvement:
- Sometimes shy to speak in front of class
- Needs more confidence with new vocabulary

Overall: Very good progress. Keep up the great work!`,
          
          recordingUrl: 'https://drive.google.com/file/d/1xyz789abc456def/view',
          
          teacherComment: `Student shows excellent progress in English.

Achievement this lesson:
- Vocabulary retention: 87%
- Pronunciation: B+
- Participation: A

Next steps:
- Practice more speaking at home
- Watch English cartoons (recommend Peppa Pig)
- Review vocabulary daily (10 mins)

Parent support:
- Ask child to describe family in English
- Practice new words together
- Encourage speaking without fear of mistakes`,
          
          homework: `Workbook pages 40-42:
- Exercise 1: Match family members (10 questions)
- Exercise 2: Fill in the blanks with pronouns
- Exercise 3: Draw your family tree and label in English

Additional:
- Watch 1 episode of "Peppa Pig" in English
- Learn 5 new family-related words from the show
- Prepare to describe your extended family next week

Deadline: Before next lesson (15/02/2026)

Note: Parents can help check pronunciation using Google Translate voice feature.`,
          
          additionalNotes: `Special notes:
- Student requested more speaking practice → Will add 15 mins conversation each lesson
- Parent mentioned student wants to participate in English club → Provided registration info
- Reminded parent about upcoming English competition (deadline 20/02)
- Shared link to Oxford Learner's Dictionary for home practice
- Student birthday next week → Will prepare small celebration activity
- Progress report: Student improved from 60% to 87% vocabulary retention in 4 weeks. Excellent improvement!`,
          
          submittedAt: new Date('2026-02-12T12:15:00Z'),
        },
        confirmation: {
          teacherConfirmedAt: new Date('2026-02-12T11:30:00Z'),
          parentConfirmedAt: new Date('2026-02-12T11:45:00Z'),
          finalizedAt: new Date('2026-02-12T12:00:00Z'),
          finalizedBy: parents[1]?._id,
        },
      },
    ];

    // Insert vào database
    const result = await Session.insertMany(sessions);
    console.log(`✅ Created ${result.length} sample sessions\n`);

    // Thống kê
    console.log('📊 STATISTICS:');
    console.log('================');
    
    const total = result.length;
    const withReport = result.filter(s => s.hasTeachingReport).length;
    const withoutReport = total - withReport;
    const finalized = result.filter(s => s.status === 'FINALIZED').length;
    const finalizedWithoutReport = result.filter(s => 
      s.status === 'FINALIZED' && !s.hasTeachingReport
    ).length;

    console.log(`Total sessions: ${total}`);
    console.log(`Sessions with report: ${withReport} (${(withReport/total*100).toFixed(1)}%)`);
    console.log(`Sessions without report: ${withoutReport}`);
    console.log(`FINALIZED sessions: ${finalized}`);
    console.log(`⚠️  AT RISK (FINALIZED but no report): ${finalizedWithoutReport}`);
    
    console.log('\n📝 BREAKDOWN BY STATUS:');
    const statusCount = result.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log('\n📝 REPORT QUALITY CHECK:');
    result.forEach((session, idx) => {
      if (session.hasTeachingReport) {
        const report = session.teachingReport;
        const quality = calculateQuality(report);
        const delay = session.confirmation?.finalizedAt 
          ? Math.round((report.submittedAt - session.confirmation.finalizedAt) / (1000 * 60 * 60))
          : 0;
        
        console.log(`  Session ${idx + 1}: Quality ${quality}/100, Delay ${delay}h`);
      }
    });

    console.log('\n✅ Seed completed successfully!');
    console.log('\n💡 TIP: Sử dụng MongoDB Compass hoặc query sau để xem data:');
    console.log('   db.sessions.find({ hasTeachingReport: false, status: "FINALIZED" })');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Helper: Tính quality score
function calculateQuality(report) {
  let score = 0;
  
  if (!report) return 0;
  
  // Lesson content
  if (report.lessonContent) {
    if (report.lessonContent.length >= 200) score += 30;
    else if (report.lessonContent.length >= 100) score += 20;
    else if (report.lessonContent.length >= 50) score += 10;
  }
  
  // Teacher comment
  if (report.teacherComment) {
    if (report.teacherComment.length >= 100) score += 25;
    else if (report.teacherComment.length >= 50) score += 15;
    else score += 5;
  }
  
  // Student attitude
  if (report.studentAttitude) {
    if (report.studentAttitude.length >= 50) score += 15;
    else score += 5;
  }
  
  // Homework
  if (report.homework && report.homework.length >= 20) score += 15;
  
  // Recording URL
  if (report.recordingUrl) score += 10;
  
  // Additional notes
  if (report.additionalNotes && report.additionalNotes.length >= 30) score += 5;
  
  return Math.min(score, 100);
}

// Run
seedTeachingReports();
