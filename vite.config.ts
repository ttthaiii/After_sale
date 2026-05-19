import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'

const require = createRequire(import.meta.url);

// https://vite.dev/config/
export default defineConfig(async ({ command }) => {
  const plugins: any[] = [react()];
  
  if (command === 'serve') {
    try {
      const admin = require('firebase-admin');
      
      let laborApp: any;
      let afterSaleApp: any;
      
      try {
        laborApp = admin.apps.find((app: any) => app.name === 'laborServer') || admin.initializeApp({
          credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
        }, 'laborServer');
      } catch (e) {
        console.log("Vite Server Labor Admin init error:", e);
      }
      
      try {
        afterSaleApp = admin.apps.find((app: any) => app.name === 'afterSaleServer') || admin.initializeApp({
          credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
        }, 'afterSaleServer');
      } catch (e) {
        console.log("Vite Server After Sale Admin init error:", e);
      }
      
      const laborDb = laborApp ? laborApp.firestore() : null;
      const afterSaleDb = afterSaleApp ? afterSaleApp.firestore() : null;
      
      // ✅ Real-time Firestore Bidirectional Sync Listeners
      if ((globalThis as any)._afterSaleSyncUnsubscribe) {
        try { (globalThis as any)._afterSaleSyncUnsubscribe(); } catch (e) {}
      }
      if ((globalThis as any)._laborSyncUnsubscribe) {
        try { (globalThis as any)._laborSyncUnsubscribe(); } catch (e) {}
      }
      if ((globalThis as any)._afterSaleProjectSyncUnsubscribe) {
        try { (globalThis as any)._afterSaleProjectSyncUnsubscribe(); } catch (e) {}
      }
      if ((globalThis as any)._laborProjectSyncUnsubscribe) {
        try { (globalThis as any)._laborProjectSyncUnsubscribe(); } catch (e) {}
      }

      const getMillis = (val: any): number => {
        if (!val) return 0;
        if (typeof val === 'string') {
          return new Date(val).getTime();
        }
        if (typeof val === 'number') {
          return val;
        }
        if (val.toDate && typeof val.toDate === 'function') {
          return val.toDate().getTime();
        }
        if (val.seconds !== undefined) {
          return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
        }
        if (val._seconds !== undefined) {
          return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1000000);
        }
        return new Date(val).getTime() || 0;
      };

      const isUserDocEqual = (docA: any, docB: any) => {
        if (!docA || !docB) return false;
        return docA.name === docB.name &&
               docA.username === docB.username &&
               (docA.password || '') === (docB.password || '') &&
               docA.passwordHash === docB.passwordHash &&
               docA.roleId === docB.roleId &&
               docA.department === docB.department &&
               JSON.stringify(docA.projectLocationIds || []) === JSON.stringify(docB.projectLocationIds || []) &&
               (docA.isActive !== undefined ? docA.isActive : true) === (docB.isActive !== undefined ? docB.isActive : true);
      };

      const isProjectDocEqual = (docA: any, docB: any) => {
        if (!docA || !docB) return false;
        const nameA = docA.projectName || docA.name || '';
        const nameB = docB.projectName || docB.name || '';
        const codeA = docA.projectCode || docA.code || '';
        const codeB = docB.projectCode || docB.code || '';
        const affA = docA.department || docA.affiliation || '';
        const affB = docB.department || docB.affiliation || '';
        const imgA = docA.imageUrl || '';
        const imgB = docB.imageUrl || '';
        const statusA = docA.status || 'กำลังดำเนินการอยู่';
        const statusB = docB.status || 'กำลังดำเนินการอยู่';
        return nameA === nameB &&
               codeA === codeB &&
               affA === affB &&
               imgA === imgB &&
               statusA === statusB;
      };

      if (afterSaleDb && laborDb) {
        console.log("[Vite Server] 🔄 Starting Bidirectional Real-time Firestore Sync Listeners (After Sale <-> Labor)...");
        
        // 1. After-Sale -> Labor Sync
        try {
          const unsubAS = afterSaleDb.collection('users')
            .where('systemCode', '==', 'AS')
            .onSnapshot((snapshot: any) => {
              snapshot.docChanges().forEach(async (change: any) => {
                const userId = change.doc.id;
                const userData = change.doc.data();
                
                if (change.type === 'added' || change.type === 'modified') {
                  try {
                    const laborDoc = await laborDb.collection('users').doc(userId).get();
                    if (laborDoc.exists) {
                      const laborData = laborDoc.data();
                      if (isUserDocEqual(userData, laborData)) {
                        return; // Already matched, prevent infinite loop
                      }
                      
                      // Timestamp check: only overwrite Labor if After-Sale changes are newer
                      const asMillis = getMillis(userData.updatedAt);
                      const laborMillis = getMillis(laborData.updatedAt);
                      if (asMillis <= laborMillis) {
                        console.log(`[Vite Server Listener] ℹ️ AS -> Labor: Skipping user ${userId} sync because Labor has newer or equal modifications (${laborMillis} >= ${asMillis}).`);
                        return;
                      }
                    }

                    console.log(`[Vite Server Listener] 🔄 Syncing After Sale -> Labor: ${userId} (${userData.name})...`);
                    const isNativeLaborUser = userId === '100051' || userId === '101510';
                    const updatePayload: any = {
                      employeeId: userData.employeeId || userId,
                      name: userData.name || '',
                      username: userData.username || '',
                      password: userData.password || '',
                      passwordHash: userData.passwordHash || '',
                      roleId: userData.roleId || 'FM',
                      department: userData.department || 'WH',
                      projectLocationIds: userData.projectLocationIds || [],
                      isActive: userData.isActive !== undefined ? userData.isActive : true,
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (!isNativeLaborUser) {
                      updatePayload.systemCode = 'AS';
                    }
                    
                    await laborDb.collection('users').doc(userId).set(updatePayload, { merge: true });
                    console.log(`[Vite Server Listener] ✅ Sync After Sale -> Labor completed for ${userId}.`);
                  } catch (err: any) {
                    console.error(`[Vite Server Listener] ❌ Sync After Sale -> Labor failed for ${userId}:`, err);
                  }
                }
              });
            }, (error: any) => {
              console.error("[Vite Server Listener] After Sale listener error:", error);
            });
            
          (globalThis as any)._afterSaleSyncUnsubscribe = unsubAS;
        } catch (err) {
          console.error("[Vite Server Listener] Failed to start After Sale listener:", err);
        }

        // 2. Labor -> After-Sale Sync
        try {
          const unsubLB = laborDb.collection('users')
            .where('systemCode', '==', 'AS')
            .onSnapshot((snapshot: any) => {
              snapshot.docChanges().forEach(async (change: any) => {
                const userId = change.doc.id;
                const userData = change.doc.data();
                
                if (change.type === 'added' || change.type === 'modified') {
                  try {
                    const afterSaleDoc = await afterSaleDb.collection('users').doc(userId).get();
                    if (afterSaleDoc.exists) {
                      const afterSaleData = afterSaleDoc.data();
                      if (isUserDocEqual(userData, afterSaleData)) {
                        return; // Already matched, prevent infinite loop
                      }
                      
                      // Timestamp check: only overwrite After-Sale if Labor changes are newer
                      const laborMillis = getMillis(userData.updatedAt);
                      const asMillis = getMillis(afterSaleData.updatedAt);
                      if (laborMillis <= asMillis) {
                        console.log(`[Vite Server Listener] ℹ️ Labor -> AS: Skipping user ${userId} sync because After-Sale has newer or equal modifications (${asMillis} >= ${laborMillis}).`);
                        return;
                      }
                    }

                    console.log(`[Vite Server Listener] 🔄 Syncing Labor -> After Sale: ${userId} (${userData.name})...`);
                    const updatePayload: any = {
                      employeeId: userData.employeeId || userId,
                      name: userData.name || '',
                      username: userData.username || '',
                      password: userData.password || '',
                      passwordHash: userData.passwordHash || '',
                      roleId: userData.roleId || 'FM',
                      department: 'WH',
                      projectLocationIds: userData.projectLocationIds || [],
                      isActive: userData.isActive !== undefined ? userData.isActive : true,
                      systemCode: userData.systemCode || 'AS',
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    await afterSaleDb.collection('users').doc(userId).set(updatePayload, { merge: true });
                    console.log(`[Vite Server Listener] ✅ Sync Labor -> After Sale completed for ${userId}.`);
                  } catch (err: any) {
                    console.error(`[Vite Server Listener] ❌ Sync Labor -> After Sale failed for ${userId}:`, err);
                  }
                }
              });
            }, (error: any) => {
              console.error("[Vite Server Listener] Labor listener error:", error);
            });
            
          (globalThis as any)._laborSyncUnsubscribe = unsubLB;
        } catch (err) {
          console.error("[Vite Server Listener] Failed to start Labor listener:", err);
        }

        // 3. After-Sale Projects -> Labor Project Sync
        try {
          const unsubASProj = afterSaleDb.collection('projects')
            .onSnapshot((snapshot: any) => {
              snapshot.docChanges().forEach(async (change: any) => {
                const projectId = change.doc.id;
                const projectData = change.doc.data();
                
                if (change.type === 'added' || change.type === 'modified') {
                  try {
                    const laborDoc = await laborDb.collection('Project').doc(projectId).get();
                    if (laborDoc.exists) {
                      const laborData = laborDoc.data();
                      if (isProjectDocEqual(projectData, laborData)) {
                        return; // Already matched, prevent infinite loop
                      }
                      
                      // Timestamp check: only overwrite Labor if After-Sale changes are newer
                      const asMillis = getMillis(projectData.updatedAt);
                      const laborMillis = getMillis(laborData.updatedAt);
                      if (asMillis <= laborMillis) {
                        return;
                      }
                    }

                    console.log(`[Vite Server Listener] 🔄 Syncing Project After Sale -> Labor: ${projectId} (${projectData.name || projectData.projectName})...`);
                    const updatePayload: any = {
                      projectName: projectData.name || projectData.projectName || '',
                      projectCode: projectData.projectCode || projectData.code || projectId,
                      department: projectData.affiliation || projectData.department || '',
                      imageUrl: projectData.imageUrl || '',
                      status: projectData.status || 'กำลังดำเนินการอยู่',
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    await laborDb.collection('Project').doc(projectId).set(updatePayload, { merge: true });
                    console.log(`[Vite Server Listener] ✅ Sync Project After Sale -> Labor completed for ${projectId}.`);
                  } catch (err: any) {
                    console.error(`[Vite Server Listener] ❌ Sync Project After Sale -> Labor failed for ${projectId}:`, err);
                  }
                }

                if (change.type === 'removed') {
                  try {
                    console.log(`[Vite Server Listener] 🗑️ Project deleted in After Sale. Syncing delete -> Labor: ${projectId}`);
                    await laborDb.collection('Project').doc(projectId).delete();
                    console.log(`[Vite Server Listener] ✅ Deleted Project ${projectId} in Labor DB.`);
                  } catch (err: any) {
                    console.error(`[Vite Server Listener] ❌ Delete Project failed for ${projectId}:`, err);
                  }
                }
              });
            }, (error: any) => {
              console.error("[Vite Server Listener] After Sale project listener error:", error);
            });
            
          (globalThis as any)._afterSaleProjectSyncUnsubscribe = unsubASProj;
        } catch (err) {
          console.error("[Vite Server Listener] Failed to start After Sale project listener:", err);
        }

        // 4. Labor Project -> After-Sale Projects Sync
        try {
          const unsubLBProj = laborDb.collection('Project')
            .onSnapshot((snapshot: any) => {
              snapshot.docChanges().forEach(async (change: any) => {
                const projectId = change.doc.id;
                const projectData = change.doc.data();
                
                if (change.type === 'added' || change.type === 'modified') {
                  try {
                    const afterSaleDoc = await afterSaleDb.collection('projects').doc(projectId).get();
                    if (afterSaleDoc.exists) {
                      const afterSaleData = afterSaleDoc.data();
                      if (isProjectDocEqual(projectData, afterSaleData)) {
                        return; // Already matched, prevent infinite loop
                      }
                      
                      // Timestamp check: only overwrite After-Sale if Labor changes are newer
                      const laborMillis = getMillis(projectData.updatedAt);
                      const asMillis = getMillis(afterSaleData.updatedAt);
                      if (laborMillis <= asMillis) {
                        return;
                      }
                    }

                    console.log(`[Vite Server Listener] 🔄 Syncing Project Labor -> After Sale: ${projectId} (${projectData.projectName || projectData.name})...`);
                    const updatePayload: any = {
                      id: projectId,
                      code: projectId,
                      projectCode: projectData.projectCode || projectData.code || projectId,
                      name: projectData.projectName || projectData.name || '',
                      affiliation: projectData.department || projectData.affiliation || '',
                      imageUrl: projectData.imageUrl || '',
                      status: projectData.status || 'กำลังดำเนินการอยู่',
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    await afterSaleDb.collection('projects').doc(projectId).set(updatePayload, { merge: true });
                    console.log(`[Vite Server Listener] ✅ Sync Project Labor -> After Sale completed for ${projectId}.`);
                  } catch (err: any) {
                    console.error(`[Vite Server Listener] ❌ Sync Project Labor -> After Sale failed for ${projectId}:`, err);
                  }
                }

                if (change.type === 'removed') {
                  try {
                    console.log(`[Vite Server Listener] 🗑️ Project deleted in Labor. Syncing delete -> After Sale: ${projectId}`);
                    await afterSaleDb.collection('projects').doc(projectId).delete();
                    console.log(`[Vite Server Listener] ✅ Deleted Project ${projectId} in After Sale DB.`);
                  } catch (err: any) {
                    console.error(`[Vite Server Listener] ❌ Delete Project failed for ${projectId}:`, err);
                  }
                }
              });
            }, (error: any) => {
              console.error("[Vite Server Listener] Labor project listener error:", error);
            });
            
          (globalThis as any)._laborProjectSyncUnsubscribe = unsubLBProj;
        } catch (err) {
          console.error("[Vite Server Listener] Failed to start Labor project listener:", err);
        }
      }
      
      plugins.push({
        name: 'labor-sync-middleware',
        configureServer(server: any) {
          server.middlewares.use('/api/sync-user', (req: any, res: any, next: any) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk: any) => { body += chunk; });
              req.on('end', async () => {
                try {
                  const data = JSON.parse(body);
                  const userId = data.id;
                  const userData = data.userData;
                  
                  console.log(`[Vite Server API] Real-time syncing user ${userId} (${userData.name}) to Labor DB...`);
                  
                  if (laborDb) {
                    const isNativeLaborUser = userId === '100051' || userId === '101510';
                    const updatePayload: any = {
                      employeeId: userData.employeeId || userId,
                      name: userData.name || '',
                      username: userData.username || '',
                      passwordHash: userData.passwordHash || '',
                      roleId: userData.roleId || 'FM',
                      department: userData.department || 'WH',
                      projectLocationIds: userData.projectLocationIds || [],
                      isActive: userData.isActive !== undefined ? userData.isActive : true,
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (!isNativeLaborUser) {
                      updatePayload.systemCode = 'AS';
                    }
                    
                    await laborDb.collection('users').doc(userId).set(updatePayload, { merge: true });
                    console.log(`[Vite Server API] ✅ Synced user ${userId} to Labor DB successfully!`);
                  }
                  
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                } catch (e: any) {
                  console.error("[Vite Server API] Sync error:", e);
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: e.message }));
                }
              });
            } else {
              next();
            }
          });
        }
      });
    } catch (err) {
      console.error("Vite Server failed to initialize firebase-admin:", err);
    }
  }
  
  return {
    plugins
  };
})
