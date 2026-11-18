<script setup>
import { computed, ref } from 'vue';
import { catalog, categories, dayMs, exam, iso, recordId, seoulToday } from './catalog.js';
import { useStorage } from './storage.js';

const { records, local, authenticated, user, sync, error, retry, authenticate, update, importLocal, logout } = useStorage();
const today = seoulToday();
const selected = ref(today);
const month = computed(() => selected.value.slice(0, 7));
const dayLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' });
const remaining = (Date.parse(exam) - Date.parse(today)) / dayMs;
const dday = remaining === 0 ? 'D-Day' : remaining > 0 ? 'D−' + remaining : 'D+' + Math.abs(remaining);
const overviewRound = ref(1);
const browseDate = ref(false);
const showEditor = ref(false);
const settings = ref(false);
const installHelp = ref(false);
const editorCategory = ref('lc');
const editorRound = ref(1);
const selectedUnits = ref([]);
const note = ref('');
const editing = ref(null);
const editorError = ref('');
const settingsError = ref('');
const email = ref('');
const password = ref('');
const busy = ref(false);
const snackbar = ref(false);
const message = ref('');
const hideInstall = ref(matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
let installPrompt;

const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
const byDate = computed(() => records.value.reduce((map, row) => {
  (map[row.date] ??= []).push(row);
  return map;
}, {}));
const daily = computed(() => [...(byDate.value[selected.value] ?? [])].sort((a, b) => a.round - b.round || a.unit.localeCompare(b.unit)));
const monthRecords = computed(() => records.value.filter((row) => row.date.startsWith(month.value)));
const activeDays = computed(() => new Set(monthRecords.value.map((row) => row.date)).size);
const progress = computed(() => categories.map((category) => ({
  ...category,
  count: new Set(records.value.filter((row) => row.round === overviewRound.value && catalog[row.unit].category === category.id).map((row) => row.unit)).size,
})));
const groups = computed(() => Object.values(catalog).filter(({ category }) => category === editorCategory.value)
  .reduce((result, unit) => {
    (result[unit.section] ??= []).push(unit);
    return result;
  }, {}));
const roundValid = computed(() => Number.isInteger(Number(editorRound.value)) && Number(editorRound.value) >= 1 && Number(editorRound.value) <= 99);
const existingIds = computed(() => new Set(daily.value.map(recordId)));
const completed = (unit) => existingIds.value.has(recordId({ date: selected.value, unit, round: editorRound.value }));
const calendar = computed(() => {
  const start = new Date(month.value + '-01T00:00:00Z');
  const leading = (start.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: leading }, (_, index) => ({ key: 'blank-' + index }));
  for (let time = start.valueOf(); iso(time).startsWith(month.value); time += dayMs) {
    const key = iso(time);
    const items = byDate.value[key] ?? [];
    const marks = [...new Set(items.map((row) => catalog[row.unit].category))];
    cells.push({ key, date: key, number: Number(key.slice(-2)), marks, count: items.length });
  }
  return cells;
});
const monthTitle = computed(() => month.value.slice(0, 4) + '년 ' + Number(month.value.slice(-2)) + '월');
function moveMonth(offset) {
  const date = new Date(month.value + '-01T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  const target = iso(date);
  selected.value = target.startsWith(today.slice(0, 7)) ? today : target;
}
function jump(event) {
  if (event.target.value) selected.value = event.target.value;
  browseDate.value = false;
}
function announce(text) {
  message.value = text;
  snackbar.value = true;
}
function openEditor(row = null) {
  editing.value = row;
  editorCategory.value = row ? catalog[row.unit].category : 'lc';
  editorRound.value = row?.round ?? overviewRound.value;
  selectedUnits.value = row ? [row.unit] : [];
  note.value = row?.note ?? '';
  editorError.value = '';
  showEditor.value = true;
}
function toggle(unit) {
  if (editing.value) {
    selectedUnits.value = [unit];
  } else {
    const list = selectedUnits.value;
    selectedUnits.value = list.includes(unit) ? list.filter((id) => id !== unit) : [...list, unit];
  }
}
function save() {
  if (!roundValid.value || !selectedUnits.value.length) return;
  const next = selectedUnits.value.map((unit) => ({ date: selected.value, unit, round: Number(editorRound.value), note: note.value.trim() }));
  const oldId = editing.value && recordId(editing.value);
  const duplicates = next.filter((row) => recordId(row) !== oldId && existingIds.value.has(recordId(row)));
  if (duplicates.length) {
    editorError.value = '같은 날짜에 이미 기록한 항목이 있어요. 선택이나 회독을 확인하세요.';
    return;
  }
  try {
    update(next, oldId && recordId(next[0]) !== oldId ? [oldId] : []);
    showEditor.value = false;
    announce(editing.value ? '기록을 수정했어요.' : next.length + '개 학습 기록을 추가했어요.');
  } catch (failure) {
    editorError.value = failure.message;
  }
}
const deleting = ref(null);
function remove() {
  try {
    update([], [recordId(deleting.value)]);
    deleting.value = null;
    announce('학습 기록을 삭제했어요.');
  } catch (failure) {
    announce(failure.message);
  }
}
async function account(action) {
  busy.value = true;
  settingsError.value = '';
  try {
    if (action === '로그아웃') await logout();
    else if (action === '기록 옮기기') {
      await importLocal();
      announce('이 브라우저의 학습 기록을 Firebase로 옮겼어요.');
    } else {
      await authenticate(email.value, password.value, action === '계정 만들기');
      password.value = '';
    }
  } catch (failure) {
    const messages = {
      'auth/invalid-credential': '이메일 또는 비밀번호를 확인하세요.',
      'auth/email-already-in-use': '이미 등록된 이메일입니다. 로그인해 주세요.',
      'auth/operation-not-allowed': 'Firebase Authentication에서 이메일/비밀번호 로그인을 활성화하세요.',
      'auth/invalid-email': '이메일 주소를 확인하세요.',
      'auth/network-request-failed': '네트워크 연결을 확인하세요.',
      'auth/weak-password': '비밀번호를 6자 이상 입력하세요.',
      'auth/invalid-api-key': 'Firebase 웹 앱의 API 키를 확인하세요.',
    };
    settingsError.value = messages[failure.code] ?? (failure.code ? '요청에 실패했습니다. Firebase 설정과 연결을 확인하세요.' : failure.message);
  } finally {
    busy.value = false;
  }
}
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => {
  hideInstall.value = true;
  installPrompt = null;
});
async function install() {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
  } else {
    installHelp.value = true;
  }
}
</script>

<template>
  <v-app>
    <header class="topbar">
      <div class="top-inner">
        <a class="brand" href="./"><span aria-hidden="true">✓</span><strong>토익 800 플래너</strong></a>
        <div class="header-actions">
          <v-btn v-if="!hideInstall" size="small" variant="text" @click="install">앱 설치</v-btn>
          <v-btn size="small" variant="tonal" color="primary" @click="settings = true; settingsError = ''">Firebase</v-btn>
        </div>
      </div>
    </header>
    <v-main tag="div">
      <main class="page">
        <section class="hero">
          <div><p class="hero-kicker">TOEIC STUDY LOG</p><h1>오늘의 토익 기록</h1><p>교재 Day부터 실전문제집까지, 공부한 만큼 체크하세요.</p></div>
          <div class="goal"><strong>{{ dday }}</strong><span>2027.01.16 · 목표 800점 이상</span></div>
        </section>

        <section aria-labelledby="progress-title">
          <div class="section-heading">
            <div><h2 id="progress-title">회독 진도</h2><p>전체 기록에서 완료한 항목 수</p></div>
            <div class="round-control">
              <v-btn variant="text" size="small" aria-label="이전 회독" :disabled="overviewRound === 1" @click="overviewRound--">‹</v-btn>
              <span>{{ overviewRound }}회독</span>
              <v-btn variant="text" size="small" aria-label="다음 회독" :disabled="overviewRound === 99" @click="overviewRound++">›</v-btn>
            </div>
          </div>
          <div class="stats">
            <v-card v-for="item in progress" :key="item.id" class="stat">
              <div class="stat-label"><i :style="{ background: item.color }"></i>{{ item.label }}<small>{{ item.name }}</small></div>
              <div class="stat-number">{{ item.count }} <span>/ {{ item.total }}</span></div>
              <v-progress-linear :model-value="100 * item.count / item.total" :color="item.color" rounded height="5" :aria-label="item.label + ' 회독 진도'" />
            </v-card>
          </div>
        </section>

        <v-alert v-if="error" type="error" variant="tonal" class="mt-4" :icon="false">{{ error }}</v-alert>
        <div class="workspace">
          <v-card class="panel">
            <div class="section-heading calendar-title">
              <div><h2>{{ monthTitle }}</h2><p>학습 {{ activeDays }}일 · 기록 {{ monthRecords.length }}개</p></div>
              <div class="calendar-actions">
                <v-btn size="small" variant="text" aria-label="이전 달" @click="moveMonth(-1)">‹</v-btn>
                <v-btn size="small" variant="tonal" color="primary" @click="selected = today">오늘</v-btn>
                <v-btn size="small" variant="text" aria-label="다음 달" @click="moveMonth(1)">›</v-btn>
              </div>
            </div>
            <div class="calendar-grid week" aria-hidden="true"><span v-for="day in ['월', '화', '수', '목', '금', '토', '일']" :key="day">{{ day }}</span></div>
            <div class="calendar-grid" aria-label="학습 달력">
              <template v-for="cell in calendar" :key="cell.key">
                <button v-if="cell.date" type="button" class="day" :class="{ 'has-record': cell.count > 0 }"
                  :aria-pressed="selected === cell.date" :aria-current="cell.date === today ? 'date' : undefined"
                  :aria-label="dayLabel.format(Date.parse(cell.date)) + (cell.date === exam ? ' 시험 목표일' : '') + ', 기록 ' + cell.count + '개'"
                  @click="selected = cell.date">
                  {{ cell.number }}
                  <span v-if="cell.date === exam" class="exam-mark">시험</span>
                  <span v-else class="marks" aria-hidden="true"><i v-for="mark in cell.marks" :key="mark" :style="{ background: categoryById[mark].color }"></i></span>
                </button>
                <span v-else></span>
              </template>
            </div>
            <div class="calendar-foot">
              <div class="legend"><span v-for="item in categories" :key="item.id"><i :style="{ background: item.color }"></i>{{ item.label }}</span></div>
              <v-btn size="small" variant="text" @click="browseDate = !browseDate">날짜 이동</v-btn>
            </div>
            <label v-if="browseDate" class="jump">이동할 날짜 <input type="date" min="1900-01-01" max="9999-12-31" :value="selected" @change="jump"></label>
          </v-card>

          <v-card class="panel">
            <div class="section-heading daily-title">
              <div><h2>{{ dayLabel.format(Date.parse(selected)) }}</h2><p>{{ selected === exam ? '시험 목표일 · ' : '' }}학습 기록 {{ daily.length }}개</p></div>
              <v-btn color="primary" :disabled="!authenticated" @click="openEditor()">＋ 기록 추가</v-btn>
            </div>
            <div v-if="!daily.length" class="empty"><span aria-hidden="true">✓</span><strong>아직 학습 기록이 없어요</strong><p>이날 공부한 항목을 선택해서 체크하세요.</p></div>
            <ul v-else class="records">
              <li v-for="row in daily" :key="recordId(row)">
                <div class="record-main">
                  <div class="record-meta">
                    <v-chip size="x-small" variant="tonal" :color="categoryById[catalog[row.unit].category].color">{{ categoryById[catalog[row.unit].category].label }}</v-chip>
                    <span v-if="catalog[row.unit].section.startsWith('Part')">{{ catalog[row.unit].section }}</span>
                    <span>{{ row.round }}회독</span>
                  </div>
                  <strong>{{ catalog[row.unit].label }}</strong>
                  <p v-if="row.note">{{ row.note }}</p>
                </div>
                <v-btn size="small" variant="text" :aria-label="catalog[row.unit].label + ' 수정'" @click="openEditor(row)">수정</v-btn>
                <v-btn size="small" variant="text" :aria-label="catalog[row.unit].label + ' 삭제'" @click="deleting = row">삭제</v-btn>
              </li>
            </ul>
          </v-card>
        </div>
        <footer><span>{{ user ? 'Firebase · ' + sync : '이 브라우저에 저장 중' }}</span><span>토익 800 플래너</span></footer>
      </main>
    </v-main>

    <v-dialog v-model="showEditor" max-width="600" scrollable>
      <v-card class="dialog">
        <div class="section-heading"><div><h2>{{ editing ? '학습 기록 수정' : '학습 기록 추가' }}</h2><p>{{ dayLabel.format(Date.parse(selected)) }} · {{ editing ? '기록 한 개 수정' : '여러 항목 선택 가능' }}</p></div><v-btn size="small" variant="text" @click="showEditor = false">닫기</v-btn></div>
        <form @submit.prevent="save">
          <div class="editor-controls">
            <div class="categories" role="group" aria-label="교재 선택">
              <v-btn v-for="item in categories" :key="item.id" size="small" :variant="editorCategory === item.id ? 'flat' : 'tonal'" :color="item.color" :aria-pressed="editorCategory === item.id" @click="editorCategory = item.id">{{ item.label }}</v-btn>
            </div>
            <v-text-field v-model="editorRound" label="회독" type="number" min="1" max="99" hide-details class="round-input" />
          </div>
          <div class="picker">
            <p v-if="editorCategory === 'test'" class="picker-note">해커스 토익 실전문제집</p>
            <div v-for="(units, section) in groups" :key="section" class="unit-group">
              <h3>{{ section }}</h3>
              <div class="units">
                <v-btn v-for="unit in units" :key="unit.id" size="small"
                  :variant="selectedUnits.includes(unit.id) ? 'flat' : 'outlined'" :color="selectedUnits.includes(unit.id) ? 'primary' : undefined"
                  :disabled="completed(unit.id) && !(editing && unit.id === editing.unit && Number(editorRound) === editing.round)"
                  :aria-pressed="selectedUnits.includes(unit.id)" @click="toggle(unit.id)">{{ unit.label }}<span v-if="completed(unit.id)" class="unit-check"> ✓</span></v-btn>
              </div>
            </div>
          </div>
          <v-textarea v-model="note" label="메모 (선택)" variant="outlined" rows="2" maxlength="300" auto-grow hide-details />
          <v-alert v-if="editorError" type="error" variant="tonal" :icon="false" class="mt-3">{{ editorError }}</v-alert>
          <div class="dialog-actions"><span>{{ selectedUnits.length }}개 선택</span><v-btn color="primary" type="submit" :disabled="!selectedUnits.length || !roundValid">기록 저장</v-btn></div>
        </form>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="Boolean(deleting)" max-width="420" @update:model-value="deleting = null">
      <v-card class="dialog">
        <h2>학습 기록 삭제</h2><p class="dialog-copy">{{ catalog[deleting?.unit]?.label }} · {{ deleting?.round }}회독 기록을 삭제할까요?</p>
        <div class="dialog-actions"><v-btn variant="text" @click="deleting = null">취소</v-btn><v-btn color="error" @click="remove">삭제</v-btn></div>
      </v-card>
    </v-dialog>

    <v-dialog v-model="settings" max-width="580" scrollable>
      <v-card class="dialog">
        <div class="section-heading"><div><h2>Firebase 연결</h2><p>{{ 'toeic-79a8f · ' + (user ? sync : '로그인 필요') }}</p></div><v-btn size="small" variant="text" @click="settings = false">닫기</v-btn></div>
        <form v-if="!user" @submit.prevent="account('로그인')">
          <p class="dialog-copy">같은 Firebase 계정으로 로그인하면 다른 기기에서도 학습 기록을 볼 수 있어요.</p>
          <v-text-field v-model="email" label="이메일" type="email" autocomplete="username" required />
          <v-text-field v-model="password" label="비밀번호" type="password" autocomplete="current-password" required />
          <div class="dialog-actions settings-actions">
            <v-btn variant="outlined" :disabled="busy || !email || password.length < 6" @click="account('계정 만들기')">계정 만들기</v-btn>
            <v-btn type="submit" color="primary" :disabled="busy || !email || !password">로그인</v-btn>
          </div>
        </form>
        <template v-else>
          <p class="dialog-copy">{{ user.email }}</p>
          <v-alert v-if="local.length" variant="tonal" color="primary" :icon="false" class="mb-4">
            이 브라우저에 옮길 수 있는 학습 기록이 {{ local.length }}개 있어요.
            <v-btn class="mt-2" size="small" variant="flat" color="primary" :disabled="busy || sync !== '동기화됨'" @click="account('기록 옮기기')">기록 옮기기</v-btn>
          </v-alert>
          <div class="dialog-actions">
            <v-btn v-if="error" variant="tonal" color="primary" @click="retry">동기화 다시 시도</v-btn>
            <v-btn variant="outlined" :disabled="busy" @click="account('로그아웃')">로그아웃</v-btn>
          </div>
        </template>
        <p class="dialog-copy"><a href="./database.rules.json" target="_blank" rel="noopener">Realtime Database 보안 규칙 보기</a></p>
        <v-alert v-if="settingsError" class="mt-3" type="error" variant="tonal" :icon="false">{{ settingsError }}</v-alert>
      </v-card>
    </v-dialog>

    <v-dialog v-model="installHelp" max-width="420">
      <v-card class="dialog"><h2>홈 화면에 추가</h2><p class="dialog-copy">iPhone에서는 Safari의 공유 메뉴에서 ‘홈 화면에 추가’를 선택하세요. Android나 PC에서는 Chrome 또는 Edge 메뉴에서 ‘앱 설치’를 선택하세요.</p><div class="dialog-actions"><v-btn color="primary" @click="installHelp = false">닫기</v-btn></div></v-card>
    </v-dialog>
    <v-snackbar v-model="snackbar" timeout="2800">{{ message }}</v-snackbar>
  </v-app>
</template>
