import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as path from 'path';

// Default app = After Sale project (this function's own project).
if (!admin.apps.length) {
  admin.initializeApp();
}

// ----------------------------------------------------------------------
// Labor app — cross-project write target.
// Service account bundled at cloud-functions/labor-management-system.json.
// Compiles to lib/userSync.js, so the key sits one level up (../).
// gitignored — never committed.
// ----------------------------------------------------------------------
const LABOR_APP_NAME = 'laborApp';
const getLaborDb = (): admin.firestore.Firestore => {
  const existing = admin.apps.find((a) => a && a.name === LABOR_APP_NAME);
  if (existing) return existing.firestore();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const laborSA = require(path.resolve(__dirname, '../labor-management-system.json'));
  const laborApp = admin.initializeApp(
    { credential: admin.credential.cert(laborSA) },
    LABOR_APP_NAME
  );
  return laborApp.firestore();
};

/**
 * userSync — ONE-WAY sync: After Sale users -> Labor users.
 *
 * HTTP endpoint (NOT a Firestore trigger). The After Sale Firestore database
 * lives in asia-southeast3 (Jakarta) where Cloud Functions cannot run, so a
 * native Firestore trigger is impossible. Instead the After Sale client calls
 * this endpoint right after writing users/{id} — the same proven pattern as
 * syncDailyReport. Deployed in asia-southeast1 (HTTP funcs are region-free).
 *
 * Body:
 *   { id: string, userData: {...} }              -> create/update in Labor
 *   { id: string, action: "delete" }             -> delete in Labor
 *
 * role is forwarded as the full name (Admin/Foreman/Manager/Approver); Labor
 * does not map it. Only After Sale-owned users (systemCode === 'AS') are synced.
 */
export const userSync = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const { id, action, userData } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const laborDb = getLaborDb();

      // --- DELETE propagate ---------------------------------------------
      if (action === 'delete') {
        await laborDb.collection('users').doc(id).delete();
        console.log(`[userSync] ✅ Deleted user ${id} in Labor.`);
        res.status(200).json({ success: true, action: 'delete', id });
        return;
      }

      // --- CREATE / UPDATE ----------------------------------------------
      if (!userData) {
        res.status(400).json({ error: 'Missing required parameter: userData' });
        return;
      }
      if (userData.systemCode !== 'AS') {
        console.log(`[userSync] Skip ${id}: not an After Sale user (systemCode=${userData.systemCode}).`);
        res.status(200).json({ success: true, skipped: true, reason: 'not AS user' });
        return;
      }

      const payload: admin.firestore.DocumentData = {
        employeeId: userData.employeeId || id,
        name: userData.name || '',
        username: userData.username || '',
        password: userData.password || '',
        passwordHash: userData.passwordHash || '',
        role: userData.role || 'Foreman', // full name — Labor does not map it
        roleId: userData.roleId || 'FM', // legacy Labor-facing code, forwarded as-is
        department: userData.department || 'WH',
        projectLocationIds: userData.projectLocationIds || [],
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        systemCode: 'AS',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await laborDb.collection('users').doc(id).set(payload, { merge: true });
      console.log(`[userSync] ✅ Synced user ${id} (${payload.name}) After Sale -> Labor.`);
      res.status(200).json({ success: true, id });
    } catch (error: any) {
      console.error('[userSync] ❌ Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
