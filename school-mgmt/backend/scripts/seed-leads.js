/**
 * seed-leads.js — Tạo leads mẫu & phân bổ cho sale để test
 *
 * Chạy:  node scripts/seed-leads.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tungtran';
const oid = () => new mongoose.Types.ObjectId();
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

async function main() {
  console.log('🔗 Connecting to', MONGO_URI.replace(/\/\/.*@/, '//<hidden>@'));
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // ── 1. Tìm sale users hiện có ──
  const usersCol = db.collection('users');
  const sales = await usersCol.find({ role: 'SALE', active: { $ne: false } }).toArray();
  if (sales.length === 0) {
    console.log('⚠️  Không có user SALE nào trong DB. Vui lòng chạy seed-all.js trước.');
    await mongoose.disconnect();
    return;
  }
  console.log(`✅ Tìm thấy ${sales.length} Sale users:`);
  sales.forEach(s => console.log(`   - ${s.fullName} (${s.email})`));

  // ── 2. Xoá leads cũ (seed) ──
  const leadsCol = db.collection('leads');
  const deleted = await leadsCol.deleteMany({ leadCode: /^SEED-/ });
  console.log(`🗑️  Đã xoá ${deleted.deletedCount} leads seed cũ`);

  // ── 3. Tạo leads mẫu ──
  const now = new Date();
  const leadData = [
    // ── Nhóm 1: Đã phân bổ cho Sale 1, có liên hệ gần đây (không quá hạn) ──
    {
      leadCode: 'SEED-001', parentName: 'Nguyễn Văn Minh', parentPhone: '0901234001',
      parentEmail: 'minh.nv@gmail.com', studentName: 'Nguyễn Minh Anh', studentGrade: 'Lớp 3',
      source: 'FACEBOOK', status: 'CONTACTED', interestedSubjects: ['Toán', 'Tiếng Anh'],
      estimatedValue: 5000000, notes: 'Quan tâm lớp Toán nâng cao',
      saleId: sales[0]._id, saleName: sales[0].fullName,
      assignedAt: daysAgo(3), lastContactAt: daysAgo(1),
      assignmentHistory: [{ saleId: sales[0]._id, saleName: sales[0].fullName, assignedAt: daysAgo(3) }],
      contactHistory: [
        { date: daysAgo(2), method: 'CALL', notes: 'Gọi giới thiệu chương trình', contactedBy: sales[0].fullName },
        { date: daysAgo(1), method: 'ZALO', notes: 'Gửi brochure qua Zalo', contactedBy: sales[0].fullName },
      ],
      nextFollowUp: daysFromNow(2),
    },
    {
      leadCode: 'SEED-002', parentName: 'Trần Thị Lan', parentPhone: '0901234002',
      parentEmail: 'lan.tt@gmail.com', studentName: 'Trần Bảo Ngọc', studentGrade: 'Lớp 5',
      source: 'ZALO', status: 'CONSULTING', interestedSubjects: ['Tiếng Anh'],
      estimatedValue: 8000000, notes: 'Muốn học IELTS foundation',
      saleId: sales[0]._id, saleName: sales[0].fullName,
      assignedAt: daysAgo(5), lastContactAt: daysAgo(2),
      assignmentHistory: [{ saleId: sales[0]._id, saleName: sales[0].fullName, assignedAt: daysAgo(5) }],
      contactHistory: [
        { date: daysAgo(4), method: 'ZALO', notes: 'Trao đổi về lộ trình học', contactedBy: sales[0].fullName },
        { date: daysAgo(2), method: 'MEET', notes: 'Gặp mặt tại trung tâm, rất quan tâm', contactedBy: sales[0].fullName },
      ],
      nextFollowUp: daysFromNow(1),
    },

    // ── Nhóm 2: Đã phân bổ cho Sale 2, KHÔNG liên hệ > 7 ngày (quá hạn → sẽ bị CRON thu hồi) ──
    {
      leadCode: 'SEED-003', parentName: 'Lê Hoàng Phúc', parentPhone: '0901234003',
      studentName: 'Lê Phúc An', studentGrade: 'Lớp 7',
      source: 'GOOGLE', status: 'NEW', interestedSubjects: ['Toán', 'Lý'],
      estimatedValue: 6000000,
      saleId: sales.length > 1 ? sales[1]._id : sales[0]._id,
      saleName: sales.length > 1 ? sales[1].fullName : sales[0].fullName,
      assignedAt: daysAgo(10), lastContactAt: null,
      assignmentHistory: [{
        saleId: sales.length > 1 ? sales[1]._id : sales[0]._id,
        saleName: sales.length > 1 ? sales[1].fullName : sales[0].fullName,
        assignedAt: daysAgo(10),
      }],
      contactHistory: [],
      notes: 'Lead từ quảng cáo Google, chưa liên hệ được',
    },
    {
      leadCode: 'SEED-004', parentName: 'Phạm Thị Hương', parentPhone: '0901234004',
      parentEmail: 'huong.pt@yahoo.com', studentName: 'Phạm Gia Huy', studentGrade: 'Lớp 9',
      source: 'FACEBOOK', status: 'CONTACTED', interestedSubjects: ['Toán', 'Hoá'],
      estimatedValue: 10000000,
      saleId: sales.length > 1 ? sales[1]._id : sales[0]._id,
      saleName: sales.length > 1 ? sales[1].fullName : sales[0].fullName,
      assignedAt: daysAgo(12), lastContactAt: daysAgo(9),
      assignmentHistory: [{
        saleId: sales.length > 1 ? sales[1]._id : sales[0]._id,
        saleName: sales.length > 1 ? sales[1].fullName : sales[0].fullName,
        assignedAt: daysAgo(12),
      }],
      contactHistory: [
        { date: daysAgo(11), method: 'CALL', notes: 'Gọi lần 1, không nghe máy', contactedBy: sales.length > 1 ? sales[1].fullName : sales[0].fullName },
        { date: daysAgo(9), method: 'SMS', notes: 'Nhắn tin, chưa trả lời', contactedBy: sales.length > 1 ? sales[1].fullName : sales[0].fullName },
      ],
      notes: 'Cần ôn thi vào 10',
    },

    // ── Nhóm 3: Chưa phân bổ (trong kho) ──
    {
      leadCode: 'SEED-005', parentName: 'Võ Đình Tùng', parentPhone: '0901234005',
      studentName: 'Võ Tùng Lâm', studentGrade: 'Lớp 1',
      source: 'WALK_IN', status: 'NEW', interestedSubjects: ['Tiếng Anh'],
      estimatedValue: 3000000,
      saleId: null, saleName: null, assignedAt: null,
      contactHistory: [], assignmentHistory: [],
      notes: 'Phụ huynh đến trực tiếp hỏi lớp cho con lớp 1',
    },
    {
      leadCode: 'SEED-006', parentName: 'Đỗ Minh Tuấn', parentPhone: '0901234006',
      parentEmail: 'tuan.dm@gmail.com', studentName: 'Đỗ Minh Khôi', studentGrade: 'Lớp 4',
      source: 'REFERRAL', status: 'NEW', interestedSubjects: ['Toán'],
      estimatedValue: 4500000, referredBy: 'Chị Hoa (phụ huynh cũ)',
      saleId: null, saleName: null, assignedAt: null,
      contactHistory: [], assignmentHistory: [],
      notes: 'Được giới thiệu từ phụ huynh cũ',
    },
    {
      leadCode: 'SEED-007', parentName: 'Bùi Thanh Hà', parentPhone: '0901234007',
      studentName: 'Bùi Khánh Linh', studentGrade: 'Lớp 6',
      source: 'TIKTOK', status: 'NEW', interestedSubjects: ['Tiếng Anh', 'Văn'],
      estimatedValue: 7000000,
      saleId: null, saleName: null, assignedAt: null,
      contactHistory: [], assignmentHistory: [],
      notes: 'Từ TikTok ads, điền form trên website',
    },

    // ── Nhóm 4: Đã phân bổ cho Sale 3 (nếu có), đang quan tâm ──
    {
      leadCode: 'SEED-008', parentName: 'Hoàng Thị Mai', parentPhone: '0901234008',
      parentEmail: 'mai.ht@gmail.com', studentName: 'Hoàng Quốc Bảo', studentGrade: 'Lớp 8',
      source: 'WEBSITE', status: 'INTERESTED', interestedSubjects: ['Toán', 'Lý', 'Hoá'],
      estimatedValue: 15000000,
      saleId: sales.length > 2 ? sales[2]._id : sales[0]._id,
      saleName: sales.length > 2 ? sales[2].fullName : sales[0].fullName,
      assignedAt: daysAgo(4), lastContactAt: daysAgo(1),
      assignmentHistory: [{
        saleId: sales.length > 2 ? sales[2]._id : sales[0]._id,
        saleName: sales.length > 2 ? sales[2].fullName : sales[0].fullName,
        assignedAt: daysAgo(4),
      }],
      contactHistory: [
        { date: daysAgo(3), method: 'CALL', notes: 'Gọi tư vấn chi tiết', contactedBy: sales.length > 2 ? sales[2].fullName : sales[0].fullName },
        { date: daysAgo(1), method: 'MEET', notes: 'Gặp mặt, rất quan tâm, hẹn đăng ký tuần sau', contactedBy: sales.length > 2 ? sales[2].fullName : sales[0].fullName },
      ],
      nextFollowUp: daysFromNow(3),
      notes: 'Lead chất lượng cao, sẵn sàng đăng ký',
    },

    // ── Nhóm 5: Đã từng phân bổ → thu hồi → phân bổ lại (có lịch sử) ──
    {
      leadCode: 'SEED-009', parentName: 'Ngô Quang Vinh', parentPhone: '0901234009',
      studentName: 'Ngô Vinh Quang', studentGrade: 'Lớp 10',
      source: 'FACEBOOK', status: 'CONSULTING', interestedSubjects: ['Toán', 'Lý'],
      estimatedValue: 12000000,
      saleId: sales[0]._id, saleName: sales[0].fullName,
      assignedAt: daysAgo(2), lastContactAt: daysAgo(1),
      returnCount: 1, returnedToPoolAt: daysAgo(3),
      assignmentHistory: [
        {
          saleId: sales.length > 1 ? sales[1]._id : sales[0]._id,
          saleName: sales.length > 1 ? sales[1].fullName : sales[0].fullName,
          assignedAt: daysAgo(15),
          returnedAt: daysAgo(3),
          returnReason: 'Tự động thu hồi — không chăm sóc sau 7 ngày',
        },
        {
          saleId: sales[0]._id, saleName: sales[0].fullName,
          assignedAt: daysAgo(2),
        },
      ],
      contactHistory: [
        { date: daysAgo(1), method: 'CALL', notes: 'Gọi lại sau khi thu hồi, PH vẫn quan tâm', contactedBy: sales[0].fullName },
      ],
      nextFollowUp: daysFromNow(1),
      notes: 'Từng bị thu hồi do Sale 2 không chăm, giờ Sale 1 đang theo',
    },

    // ── Nhóm 6: Đã chuyển đổi (converted) ──
    {
      leadCode: 'SEED-010', parentName: 'Đinh Thị Ngọc', parentPhone: '0901234010',
      parentEmail: 'ngoc.dt@gmail.com', studentName: 'Đinh Ngọc Hân', studentGrade: 'Lớp 2',
      source: 'ZALO', status: 'CONVERTED', interestedSubjects: ['Tiếng Anh'],
      estimatedValue: 5500000,
      saleId: sales[0]._id, saleName: sales[0].fullName,
      assignedAt: daysAgo(20), lastContactAt: daysAgo(7),
      assignmentHistory: [{ saleId: sales[0]._id, saleName: sales[0].fullName, assignedAt: daysAgo(20) }],
      contactHistory: [
        { date: daysAgo(19), method: 'ZALO', notes: 'Liên hệ lần đầu', contactedBy: sales[0].fullName },
        { date: daysAgo(14), method: 'MEET', notes: 'Gặp mặt tư vấn', contactedBy: sales[0].fullName },
        { date: daysAgo(7), method: 'CALL', notes: 'Xác nhận đăng ký', contactedBy: sales[0].fullName },
      ],
      notes: 'Đã đăng ký thành công',
    },

    // ── Nhóm 7: Không quan tâm (lost) ──  
    {
      leadCode: 'SEED-011', parentName: 'Trịnh Văn Đức', parentPhone: '0901234011',
      studentName: 'Trịnh Đức Minh', studentGrade: 'Lớp 11',
      source: 'GOOGLE', status: 'NOT_INTERESTED', interestedSubjects: ['Hoá'],
      lostReason: 'PRICE_TOO_HIGH', lostNotes: 'Thấy học phí cao so với nơi khác',
      saleId: sales.length > 1 ? sales[1]._id : sales[0]._id,
      saleName: sales.length > 1 ? sales[1].fullName : sales[0].fullName,
      assignedAt: daysAgo(25), lastContactAt: daysAgo(18),
      assignmentHistory: [{
        saleId: sales.length > 1 ? sales[1]._id : sales[0]._id,
        saleName: sales.length > 1 ? sales[1].fullName : sales[0].fullName,
        assignedAt: daysAgo(25),
      }],
      contactHistory: [
        { date: daysAgo(24), method: 'CALL', notes: 'Gọi giới thiệu', contactedBy: sales.length > 1 ? sales[1].fullName : sales[0].fullName },
        { date: daysAgo(18), method: 'CALL', notes: 'PH nói giá cao, sẽ cân nhắc', contactedBy: sales.length > 1 ? sales[1].fullName : sales[0].fullName },
      ],
    },

    // ── Nhóm 8: Thêm vài lead chưa phân bổ nữa ──
    {
      leadCode: 'SEED-012', parentName: 'Lý Thị Hồng', parentPhone: '0901234012',
      studentName: 'Lý Hồng Phát', studentGrade: 'Lớp 3',
      source: 'FACEBOOK', status: 'NEW', interestedSubjects: ['Toán'],
      estimatedValue: 4000000,
      saleId: null, saleName: null, assignedAt: null,
      contactHistory: [], assignmentHistory: [],
    },
    {
      leadCode: 'SEED-013', parentName: 'Phan Văn Sơn', parentPhone: '0901234013',
      parentEmail: 'son.pv@gmail.com', studentName: 'Phan Sơn Tùng',
      source: 'WEBSITE', status: 'NEW', interestedSubjects: ['Tiếng Anh', 'Toán'],
      estimatedValue: 9000000,
      saleId: null, saleName: null, assignedAt: null,
      contactHistory: [], assignmentHistory: [],
      notes: 'Điền form trên website, cần gọi sớm',
    },
    {
      leadCode: 'SEED-014', parentName: 'Đặng Thị Thuỷ', parentPhone: '0901234014',
      studentName: 'Đặng Thuỷ Tiên', studentGrade: 'Lớp 5',
      source: 'REFERRAL', status: 'NEW', interestedSubjects: ['Tiếng Anh'],
      estimatedValue: 6000000, referredBy: 'Anh Hùng (đồng nghiệp)',
      saleId: null, saleName: null, assignedAt: null,
      contactHistory: [], assignmentHistory: [],
    },
    {
      leadCode: 'SEED-015', parentName: 'Mai Xuân Trường', parentPhone: '0901234015',
      studentName: 'Mai Trường An', studentGrade: 'Lớp 12',
      source: 'TIKTOK', status: 'NEW', interestedSubjects: ['Toán', 'Lý', 'Hoá'],
      estimatedValue: 18000000,
      saleId: null, saleName: null, assignedAt: null,
      contactHistory: [], assignmentHistory: [],
      notes: 'Cần ôn thi ĐH, gấp',
    },
  ];

  // Insert
  const result = await leadsCol.insertMany(leadData.map(l => ({
    ...l,
    createdAt: l.assignedAt ? new Date(new Date(l.assignedAt).getTime() - 86400000) : daysAgo(Math.floor(Math.random() * 10) + 1),
    updatedAt: now,
  })));
  console.log(`\n✅ Đã tạo ${result.insertedCount} leads mẫu:`);

  // Summary
  const assigned = leadData.filter(l => l.saleId);
  const unassigned = leadData.filter(l => !l.saleId);
  const stale = leadData.filter(l => {
    if (!l.saleId) return false;
    const ref = l.lastContactAt || l.assignedAt;
    if (!ref) return false;
    return (now - new Date(ref).getTime()) > 7 * 24 * 60 * 60 * 1000;
  });

  console.log(`\n📊 Thống kê:`);
  console.log(`   • Đã phân bổ:     ${assigned.length} leads`);
  console.log(`   • Chưa phân bổ:   ${unassigned.length} leads (trong kho)`);
  console.log(`   • Quá hạn 7 ngày: ${stale.length} leads`);
  console.log(`   • Đã chuyển đổi:  ${leadData.filter(l => l.status === 'CONVERTED').length}`);
  console.log(`   • Không quan tâm: ${leadData.filter(l => l.status === 'NOT_INTERESTED').length}`);

  // Sales breakdown
  console.log(`\n👤 Phân bổ theo Sale:`);
  for (const s of sales) {
    const count = assigned.filter(l => String(l.saleId) === String(s._id)).length;
    if (count > 0) console.log(`   • ${s.fullName}: ${count} leads`);
  }

  console.log('\n🎉 Done! Truy cập http://localhost:4200/app/leads để xem.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
