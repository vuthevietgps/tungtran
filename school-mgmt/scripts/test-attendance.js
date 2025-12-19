// Quick E2E attendance + report test
const base = 'http://localhost:3000';
const email = 'admin1@gmail.com';
const password = '123456789';

(async () => {
  const log = (...args) => console.log('[TEST]', ...args);

  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.access_token) {
    console.error('Login failed', loginRes.status, loginData);
    process.exit(1);
  }
  const token = loginData.access_token;
  const auth = { Authorization: `Bearer ${token}` };
  log('Login ok');

  const classesRes = await fetch(`${base}/classes`, { headers: auth });
  const classes = await classesRes.json();
  const classPick = classes[0];
  if (!classPick) throw new Error('No class found');
  const classId = classPick._id || classPick.id;

  // Ensure class has at least one student by creating a placeholder when empty
  let student = (classPick.students || [])[0];
  if (!student) {
    const createStuRes = await fetch(`${base}/students`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentCode: `AUTO-${Date.now()}`,
        fullName: 'Auto Student',
        age: 10,
        parentName: 'Auto Parent',
        parentPhone: '0000000000',
        faceImage: 'https://ui-avatars.com/api/?background=667eea&color=fff&name=Auto',
        studentType: 'OFFLINE'
      })
    });
    const created = await createStuRes.json();
    if (!createStuRes.ok || !created._id) {
      throw new Error(`Create student failed: ${createStuRes.status} ${JSON.stringify(created)}`);
    }

    const patchRes = await fetch(`${base}/classes/${classId}`, {
      method: 'PATCH',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIds: [created._id] })
    });
    const patched = await patchRes.json();
    if (!patchRes.ok) throw new Error(`Assign student failed: ${patchRes.status} ${JSON.stringify(patched)}`);
    student = created;
  }

  const studentId = student?._id || student?.id || student;
  if (!studentId) throw new Error('No student in class after seeding');
  log('Picked class', classPick.code, 'student', studentId);

  const date = new Date().toISOString().split('T')[0];
  // Generate attendance link then submit to set attendedAt
  const genRes = await fetch(`${base}/attendance/generate-link`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, studentId, date })
  });
  const genData = await genRes.json();
  if (!genRes.ok || !genData.token) {
    throw new Error(`Generate link failed: ${genRes.status} ${JSON.stringify(genData)}`);
  }
  log('Generate link ok');

  const dummyImage = 'data:image/png;base64,' + Buffer.from('dummy').toString('base64');
  const submitRes = await fetch(`${base}/public/attendance/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: genData.token, imageBase64: dummyImage })
  });
  const submitData = await submitRes.json();
  if (!submitRes.ok) {
    throw new Error(`Submit attendance failed: ${submitRes.status} ${JSON.stringify(submitData)}`);
  }
  log('Submit status', submitRes.status, submitData._id || submitData.message || submitData);

  const reportRes = await fetch(`${base}/attendance/report?startDate=${date}&endDate=${date}&classId=${classId}`, { headers: auth });
  const reportData = await reportRes.json();
  log('Report status', reportRes.status, 'count', reportData.length);
  log('Sample', reportData.slice(0, 2));
})();
