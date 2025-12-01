import { connect, disconnect } from 'mongoose';
import { config } from 'dotenv';

config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/school-management';

const sampleStudents = [
  {
    studentCode: 'HS001',
    fullName: 'Nguyễn Văn An',
    age: 8,
    parentName: 'Nguyễn Văn Bình',
    parentPhone: '0901234567',
    faceImage: 'https://i.pravatar.cc/150?img=1',
    approvalStatus: 'APPROVED',
    payments: [
      {
        frameIndex: 1,
        invoiceCode: 'HD001',
        sessionsRegistered: 20,
        pricePerSession: 200000,
        amountCollected: 4000000,
        sessionsCollected: 20,
        confirmStatus: 'CONFIRMED'
      }
    ]
  },
  {
    studentCode: 'HS002',
    fullName: 'Trần Thị Bích',
    age: 7,
    parentName: 'Trần Văn Cường',
    parentPhone: '0902345678',
    faceImage: 'https://i.pravatar.cc/150?img=5',
    approvalStatus: 'APPROVED',
    payments: [
      {
        frameIndex: 1,
        invoiceCode: 'HD002',
        sessionsRegistered: 15,
        pricePerSession: 200000,
        amountCollected: 3000000,
        sessionsCollected: 15,
        confirmStatus: 'CONFIRMED'
      },
      {
        frameIndex: 2,
        invoiceCode: 'HD003',
        sessionsRegistered: 10,
        pricePerSession: 200000,
        amountCollected: 2000000,
        sessionsCollected: 10,
        confirmStatus: 'PENDING'
      }
    ]
  },
  {
    studentCode: 'HS003',
    fullName: 'Lê Minh Đức',
    age: 9,
    parentName: 'Lê Văn Em',
    parentPhone: '0903456789',
    faceImage: 'https://i.pravatar.cc/150?img=12',
    approvalStatus: 'APPROVED',
    payments: [
      {
        frameIndex: 1,
        invoiceCode: 'HD004',
        sessionsRegistered: 25,
        pricePerSession: 250000,
        amountCollected: 6250000,
        sessionsCollected: 25,
        confirmStatus: 'CONFIRMED'
      }
    ]
  },
  {
    studentCode: 'HS004',
    fullName: 'Phạm Thị Hà',
    age: 6,
    parentName: 'Phạm Văn Giang',
    parentPhone: '0904567890',
    faceImage: 'https://i.pravatar.cc/150?img=9',
    approvalStatus: 'PENDING',
    payments: []
  },
  {
    studentCode: 'HS005',
    fullName: 'Hoàng Văn Khoa',
    age: 10,
    parentName: 'Hoàng Thị Lan',
    parentPhone: '0905678901',
    faceImage: 'https://i.pravatar.cc/150?img=15',
    approvalStatus: 'APPROVED',
    payments: [
      {
        frameIndex: 1,
        invoiceCode: 'HD005',
        sessionsRegistered: 30,
        pricePerSession: 300000,
        amountCollected: 9000000,
        sessionsCollected: 30,
        confirmStatus: 'CONFIRMED'
      },
      {
        frameIndex: 2,
        invoiceCode: 'HD006',
        sessionsRegistered: 20,
        pricePerSession: 300000,
        amountCollected: 6000000,
        sessionsCollected: 15,
        confirmStatus: 'CONFIRMED'
      }
    ]
  }
];

async function seedStudents() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoose = await import('mongoose');
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully!');

    // Define schema inline
    const paymentFrameSchema = new mongoose.Schema({
      frameIndex: { type: Number, required: true },
      invoiceCode: String,
      sessionsRegistered: Number,
      pricePerSession: Number,
      amountCollected: Number,
      sessionsCollected: Number,
      confirmStatus: { type: String, enum: ['PENDING', 'CONFIRMED'], default: 'PENDING' }
    }, { _id: false });

    const studentSchema = new mongoose.Schema({
      studentCode: { type: String, required: true, unique: true },
      fullName: { type: String, required: true },
      age: { type: Number, required: true },
      parentName: { type: String, required: true },
      parentPhone: { type: String, required: true },
      faceImage: { type: String, required: true },
      approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
      payments: [paymentFrameSchema]
    }, { timestamps: true });

    const StudentModel = mongoose.models.Student || mongoose.model('Student', studentSchema);

    console.log('Clearing existing students...');
    await StudentModel.deleteMany({});

    console.log('Inserting sample students...');
    const result = await StudentModel.insertMany(sampleStudents);
    
    console.log(`✅ Successfully created ${result.length} students:`);
    result.forEach((s: any) => {
      console.log(`  - ${s.studentCode}: ${s.fullName} (${s.approvalStatus})`);
    });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding students:', error);
    process.exit(1);
  }
}

seedStudents();
