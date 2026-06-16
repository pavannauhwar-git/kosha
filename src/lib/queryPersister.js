import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

const IDB_KEY = 'kosha-rq-cache'

export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get(k),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
  key: IDB_KEY,
  throttleTime: 1000,
})

// Hard-clear persisted cache. MUST be called from purgeAllUserScopedState()
// on every auth boundary to prevent cross-user data leaks.
export async function clearPersistedQueryCache() {
  try { await del(IDB_KEY) } catch { /* IDB unavailable */ }
}
