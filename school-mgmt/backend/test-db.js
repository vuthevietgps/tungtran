const mongoose = require('mongoose');
require('dotenv').config();

async function testDatabase() {
  try {
    console.log('🔗 Đang kết nối MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ Kết nối MongoDB thành công!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('🏠 Host:', mongoose.connection.host);
    
    // Kiểm tra collections hiện có
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📂 Collections hiện có:');
    if (collections.length === 0) {
      console.log('   (Chưa có collections nào)');
    } else {
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    }
    
    // Test ping
    await mongoose.connection.db.admin().ping();
    console.log('\n🏓 Ping database thành công!');
    
    // Kiểm tra quyền ghi
    try {
      const testCol = mongoose.connection.db.collection('test_connection');
      const result = await testCol.insertOne({ test: true, timestamp: new Date() });
      console.log('✅ Test ghi dữ liệu thành công!', result.insertedId);
      
      // Xóa test document
      await testCol.deleteOne({ _id: result.insertedId });
      console.log('✅ Test xóa dữ liệu thành công!');
    } catch (error) {
      console.error('❌ Lỗi test ghi dữ liệu:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Đã ngắt kết nối MongoDB');
    process.exit(0);
  }
}

testDatabase();