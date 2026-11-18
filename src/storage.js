import { computed, ref, shallowRef } from 'vue';
import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDatabase, onValue, ref as dbRef, update as patchDatabase } from 'firebase/database';
import { recordId, validRecord } from './catalog.js';
import { firebaseConfig } from './firebase-config.js';

const localKey = 'toeic-800-study-log-v2';
const namespace = 'toeic-rtdb-' + firebaseConfig.projectId;
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const rows = (value) => Object.values(value ?? {}).filter(validRecord);
const cacheKey = (uid) => namespace + ':cache:' + uid;
const queuePrefix = (uid) => namespace + ':queue:' + uid + ':';
function queued(uid) {
  const prefix = queuePrefix(uid);
  return Object.keys(localStorage).filter((key) => key.startsWith(prefix)).sort()
    .map((key) => ({ key, patch: read(key, null) })).filter(({ patch }) => patch);
}
export function useStorage() {
  const local = ref(rows(read(localKey, [])));
  const cloud = ref([]);
  const pending = ref([]);
  const user = shallowRef(null);
  const authenticated = ref(false);
  const connected = ref(false);
  const ready = ref(false);
  const error = ref('');
  const sync = computed(() => error.value ? '동기화 오류' : pending.value.length ? '동기화 대기'
    : !connected.value ? '오프라인 기록' : ready.value ? '동기화됨' : '불러오는 중');
  const records = computed(() => {
    if (!user.value) return local.value;
    const result = Object.fromEntries(cloud.value.map((item) => [recordId(item), item]));
    for (const { patch } of pending.value) {
      for (const [id, item] of Object.entries(patch)) {
        if (item === null) delete result[id];
        else result[id] = item;
      }
    }
    return Object.values(result);
  });
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const recordPath = (uid) => dbRef(db, 'users/' + uid + '/studyRecords');
  let stopRecords;
  let flushing = false;
  let sequence = 0;

  function refreshQueue(uid) {
    if (user.value?.uid !== uid) return;
    pending.value = queued(uid);
  }
  async function flush() {
    const uid = user.value?.uid;
    if (!uid || !connected.value || flushing || error.value) return;
    flushing = true;
    const send = async () => {
      while (user.value?.uid === uid && connected.value && !error.value) {
        const entry = queued(uid)[0];
        if (!entry) break;
        await patchDatabase(recordPath(uid), entry.patch);
        localStorage.removeItem(entry.key);
        refreshQueue(uid);
      }
    };
    try {
      if (navigator.locks) await navigator.locks.request(queuePrefix(uid), send);
      else await send();
    } catch {
      if (user.value?.uid === uid) error.value = '기록을 동기화하지 못했습니다. Realtime Database 규칙을 확인한 뒤 다시 시도하세요.';
    } finally {
      flushing = false;
      if (connected.value && !error.value && user.value && queued(user.value.uid).length) void flush();
    }
  }
  function retry() {
    error.value = '';
    if (user.value) watchRecords(user.value.uid);
    void flush();
  }
  function watchRecords(uid) {
    stopRecords?.();
    ready.value = false;
    stopRecords = onValue(recordPath(uid), (snapshot) => {
      cloud.value = rows(snapshot.val());
      try { localStorage.setItem(cacheKey(uid), JSON.stringify(cloud.value)); } catch { /* Live records remain available. */ }
      ready.value = true;
    }, () => {
      error.value = '학습 기록을 읽을 수 없습니다. Realtime Database 규칙이 게시되었는지 확인하세요.';
    });
  }
  onValue(dbRef(db, '.info/connected'), (snapshot) => {
    connected.value = snapshot.val() === true;
    if (connected.value) void flush();
  });
  onAuthStateChanged(auth, (currentUser) => {
    stopRecords?.();
    stopRecords = undefined;
    user.value = currentUser;
    authenticated.value = true;
    ready.value = false;
    error.value = '';
    cloud.value = currentUser ? rows(read(cacheKey(currentUser.uid), [])) : [];
    pending.value = [];
    if (!currentUser) return;
    refreshQueue(currentUser.uid);
    watchRecords(currentUser.uid);
    void flush();
  });
  window.addEventListener('storage', (event) => {
    const uid = user.value?.uid;
    if (uid && event.key?.startsWith(queuePrefix(uid))) {
      refreshQueue(uid);
      void flush();
    }
  });
  function saveLocal(next) {
    localStorage.setItem(localKey, JSON.stringify(next));
    local.value = next;
  }
  function update(add, remove = []) {
    const uid = user.value?.uid;
    if (!uid) {
      const next = new Map(local.value.map((item) => [recordId(item), item]));
      remove.forEach((id) => next.delete(id));
      add.forEach((item) => next.set(recordId(item), item));
      saveLocal([...next.values()]);
      return;
    }
    const patch = Object.fromEntries([...remove.map((id) => [id, null]), ...add.map((item) => [recordId(item), item])]);
    const key = queuePrefix(uid) + String(Date.now()) + '-' + String(sequence++).padStart(8, '0') + '-' + crypto.randomUUID();
    localStorage.setItem(key, JSON.stringify(patch));
    refreshQueue(uid);
    void flush();
  }
  async function importLocal() {
    const uid = user.value?.uid;
    if (!uid || sync.value !== '동기화됨') throw new Error('Firebase 동기화가 끝난 뒤 기록을 옮길 수 있습니다.');
    const source = local.value;
    const existing = new Set(cloud.value.map(recordId));
    const additions = source.filter((item) => !existing.has(recordId(item)));
    if (additions.length) await patchDatabase(recordPath(uid), Object.fromEntries(additions.map((item) => [recordId(item), item])));
    if (user.value?.uid === uid && local.value === source) saveLocal([]);
  }
  const authenticate = (email, password, register) => (register ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email.trim(), password);
  return { records, local, authenticated, user, sync, error, retry, authenticate, update, importLocal, logout: () => signOut(auth) };
}
