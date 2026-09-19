import { push, ref } from 'firebase/database';
import { database } from '../firebase';

export async function logAudit({ user, action, module, recordId = '', details = '' }) {
  if (!user?.uid) return;
  try {
    await push(ref(database, 'auditLogs'), {
      userId: user.uid,
      userName: user.displayName || user.email || 'Потребител',
      action,
      module,
      recordId: recordId || '',
      details: details || '',
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}
