// Export HTTP Endpoint สำหรับการซิงค์ข้อมูล
export { syncDailyReport } from './laborSync';

// One-way Firestore trigger: After Sale users -> Labor users
export { userSync } from './userSync';
