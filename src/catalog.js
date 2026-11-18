export const exam = '2027-01-16';
export const dayMs = 86400000;
export const iso = (date) => new Date(date).toISOString().slice(0, 10);
export const seoulToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export const categories = [
  { id: 'lc', label: 'LC', name: '리스닝', color: '#245cbb', total: 20 },
  { id: 'rc', label: 'RC', name: '리딩', color: '#126b58', total: 20 },
  { id: 'voca', label: 'VOCA', name: '단어', color: '#8055a2', total: 20 },
  { id: 'test', label: '실전', name: '해커스 실전문제집', color: '#9c5622', total: 10 },
];
const sections = [
  ['lc', 'Part 1', 1, 2], ['lc', 'Part 2', 3, 8], ['lc', 'Part 3', 9, 14], ['lc', 'Part 4', 15, 20],
  ['rc', 'Part 5', 1, 9], ['rc', 'Part 6', 10, 12], ['rc', 'Part 7', 13, 20],
  ['voca', 'VOCA', 1, 20], ['test', 'LC', 1, 5], ['test', 'RC', 1, 5],
];
export const catalog = Object.fromEntries(sections.flatMap(([category, section, start, end]) =>
  Array.from({ length: end - start + 1 }, (_, index) => {
    const number = String(start + index).padStart(2, '0');
    const id = category === 'test' ? 'test-' + section.toLowerCase() + number : category + '-' + number;
    const label = category === 'test' ? section + ' ' + number : 'Day ' + number;
    return [id, { id, category, section, label }];
  }),
));
export const recordId = ({ date, unit, round }) => [date, unit, round].join('_');
export const validRecord = (record) => Boolean(record && /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
  Object.hasOwn(catalog, record.unit) && Number.isInteger(record.round) && record.round >= 1 && record.round <= 99);
