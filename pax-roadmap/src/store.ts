/**
 * Roadmap data: tracks and their tasks.
 *
 * Shared through the artifact's `db` capability (collections `tracks` and
 * `tasks`) so everyone on the team sees the same board. Where the page runs
 * without it (local dev, a preview, a signed-out viewer) it falls back to an
 * in-memory copy of the example data, clearly marked as not saved.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

export type Status = 'planned' | 'inProgress' | 'atRisk' | 'done' | 'hold';

export interface Track {
  id: string;
  name: string;
  owner: string;
  goal: string;
  order: number;
}

export interface Task {
  id: string;
  trackId: string;
  title: string;
  owner: string;
  status: Status;
  progress: number; // 0–100
  startDate: string; // 착수일 YYYY-MM-DD
  targetDate: string; // 목표일
  doneDate: string; // 완료일 ('' until done)
  note: string;
  updatedAt: string;
}

export type Mode = 'loading' | 'shared' | 'local';

// ---------- dates ----------

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function isoFromDay(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return isoFromDay(dayNumber(iso) + n);
}

/** Days left until the target (negative = late), or null once done. */
export function daysLeft(task: Task, today: string): number | null {
  if (task.status === 'done' || !task.targetDate) return null;
  return dayNumber(task.targetDate) - dayNumber(today);
}

export function isOverdue(task: Task, today: string): boolean {
  const d = daysLeft(task, today);
  return d !== null && d < 0 && task.status !== 'hold';
}

// ---------- example data (relative to today, so it always looks current) ----------

export function exampleData(today = todayISO()): {tracks: Track[]; tasks: Task[]} {
  const t = (n: number) => addDays(today, n);
  const tracks: Track[] = [
    {id: 'trk-a', name: '예시 트랙 A · 고객 경험', owner: '담당자 A', goal: '상품 상세·검색 화면 개선', order: 0},
    {id: 'trk-b', name: '예시 트랙 B · 업무 자동화', owner: '담당자 B', goal: '반복 운영 업무 자동화', order: 1},
    {id: 'trk-c', name: '예시 트랙 C · 데이터 기반', owner: '담당자 C', goal: '지표·데이터 파이프라인 정비', order: 2},
  ];
  const mk = (
    id: string, trackId: string, title: string, owner: string, status: Status,
    progress: number, s: number, e: number, done: number | null, note = '',
  ): Task => ({
    id, trackId, title, owner, status, progress,
    startDate: t(s), targetDate: t(e), doneDate: done === null ? '' : t(done),
    note, updatedAt: today,
  });
  const tasks: Task[] = [
    mk('tsk-a1', 'trk-a', '요구사항 정의', '담당자 A', 'done', 100, -60, -40, -42),
    mk('tsk-a2', 'trk-a', '화면 설계·시안', '담당자 D', 'done', 100, -40, -15, -12),
    mk('tsk-a3', 'trk-a', '프론트엔드 개발', '담당자 E', 'inProgress', 55, -14, 20, null),
    mk('tsk-a4', 'trk-a', 'A/B 테스트', '담당자 A', 'planned', 0, 21, 45, null),
    mk('tsk-b1', 'trk-b', '대상 업무 조사', '담당자 B', 'done', 100, -50, -30, -31),
    mk('tsk-b2', 'trk-b', '자동화 PoC', '담당자 F', 'atRisk', 40, -25, -3, null, '외부 API 권한 승인 대기'),
    mk('tsk-b3', 'trk-b', '운영 전환', '담당자 B', 'planned', 0, 10, 40, null),
    mk('tsk-c1', 'trk-c', '지표 정의서', '담당자 C', 'inProgress', 80, -20, 5, null),
    mk('tsk-c2', 'trk-c', '대시보드 구축', '담당자 G', 'hold', 10, -5, 30, null, '우선순위 재검토'),
  ];
  return {tracks, tasks};
}

// ---------- db access ----------

type Snap = {id: string; data(): Record<string, unknown> | undefined};
type QuerySnap = {docs: Snap[]; metadata: {fromCache: boolean}};
type DocRef = {
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
};
type Coll = {
  doc(id?: string): DocRef & {id: string};
  onSnapshot(n: (s: QuerySnap) => void, e?: (err: {code: string; message: string}) => void): () => void;
};
type DB = {collection(path: string): Coll};
type UserCap = {can(name: string): Promise<boolean | null>};
type ClaudeGlobal = {use(name: string): Promise<unknown>};

function claudeGlobal(): ClaudeGlobal | undefined {
  return (window as unknown as {claude?: ClaudeGlobal}).claude;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export interface RoadmapStore {
  mode: Mode;
  canWrite: boolean;
  isStale: boolean;
  error: string | null;
  tracks: Track[];
  tasks: Task[];
  saveTrack(t: Omit<Track, 'id' | 'order'> & {id?: string; order?: number}): Promise<void>;
  deleteTrack(id: string): Promise<void>;
  saveTask(t: Omit<Task, 'id' | 'updatedAt'> & {id?: string}): Promise<void>;
  deleteTask(id: string): Promise<void>;
  loadExamples(): Promise<void>;
  importData(d: {tracks: Track[]; tasks: Task[]}): Promise<void>;
  clearError(): void;
}

export function useRoadmapStore(): RoadmapStore {
  const [mode, setMode] = useState<Mode>('loading');
  const [canWrite, setCanWrite] = useState(true);
  const [isStale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const dbRef = useRef<DB | null>(null);

  // Subscribe once when the page starts.
  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const fallBackToLocal = () => {
      if (cancelled) return;
      const ex = exampleData();
      setTracks(ex.tracks);
      setTasks(ex.tasks);
      setMode('local');
    };
    const c = claudeGlobal();
    if (!c) {
      fallBackToLocal();
      return;
    }
    (async () => {
      const db = (await c.use('db').catch(() => null)) as DB | null;
      if (cancelled) return;
      if (!db) {
        fallBackToLocal();
        return;
      }
      dbRef.current = db;
      setMode('shared');
      const user = (await c.use('user').catch(() => null)) as UserCap | null;
      const can = user ? await user.can('data.write').catch(() => null) : null;
      if (!cancelled && can === false) setCanWrite(false);

      let pending = 2;
      const timer = window.setTimeout(() => setStale(true), 10_000);
      const settle = (fromCache: boolean) => {
        if (fromCache) return;
        pending -= 1;
        if (pending <= 0) {
          window.clearTimeout(timer);
          setStale(false);
        }
      };
      const onErr = (e: {code: string; message: string}) => {
        window.clearTimeout(timer);
        setError(`데이터를 불러오지 못했습니다 (${e.code}). 페이지를 다시 열어 주세요.`);
      };
      unsubs.push(
        db.collection('tracks').onSnapshot(s => {
          setTracks(s.docs.map(d => ({...(d.data() as unknown as Track), id: d.id})));
          settle(s.metadata.fromCache);
        }, onErr),
      );
      unsubs.push(
        db.collection('tasks').onSnapshot(s => {
          setTasks(s.docs.map(d => ({...(d.data() as unknown as Task), id: d.id})));
          settle(s.metadata.fromCache);
        }, onErr),
      );
      unsubs.push(() => window.clearTimeout(timer));
    })();
    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
    };
  }, []);

  const write = useCallback(
    async (coll: 'tracks' | 'tasks', id: string, body: Record<string, unknown> | null) => {
      const db = dbRef.current;
      if (!db) return;
      try {
        const ref = db.collection(coll).doc(id);
        if (body) await ref.set(body);
        else await ref.delete();
      } catch (e) {
        const code = (e as {code?: string}).code ?? 'unavailable';
        if (code === 'invalid_argument') setCanWrite(false);
        setError(
          code === 'quota_exceeded'
            ? '저장 공간이 가득 찼습니다. 끝난 과제를 정리한 뒤 다시 시도해 주세요.'
            : code === 'invalid_argument'
              ? '이 보드를 수정할 권한이 없습니다. 소유자에게 편집 권한을 요청해 주세요.'
              : '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
        throw e;
      }
    },
    [],
  );

  const saveTrack: RoadmapStore['saveTrack'] = useCallback(
    async t => {
      const id = t.id ?? newId('trk');
      const order = t.order ?? tracks.reduce((m, x) => Math.max(m, x.order + 1), 0);
      const track: Track = {id, name: t.name, owner: t.owner, goal: t.goal, order};
      setTracks(prev => [...prev.filter(x => x.id !== id), track]);
      const {id: _omit, ...body} = track;
      void _omit;
      await write('tracks', id, body);
    },
    [tracks, write],
  );

  const deleteTrack = useCallback(
    async (id: string) => {
      const owned = tasks.filter(t => t.trackId === id);
      setTracks(prev => prev.filter(x => x.id !== id));
      setTasks(prev => prev.filter(x => x.trackId !== id));
      for (const t of owned) await write('tasks', t.id, null);
      await write('tracks', id, null);
    },
    [tasks, write],
  );

  const saveTask: RoadmapStore['saveTask'] = useCallback(
    async t => {
      const id = t.id ?? newId('tsk');
      const task: Task = {...t, id, updatedAt: todayISO()} as Task;
      setTasks(prev => [...prev.filter(x => x.id !== id), task]);
      const {id: _omit, ...body} = task;
      void _omit;
      await write('tasks', id, body as unknown as Record<string, unknown>);
    },
    [write],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      setTasks(prev => prev.filter(x => x.id !== id));
      await write('tasks', id, null);
    },
    [write],
  );

  const importData = useCallback(
    async (d: {tracks: Track[]; tasks: Task[]}) => {
      setTracks(prev => [...prev.filter(p => !d.tracks.some(x => x.id === p.id)), ...d.tracks]);
      setTasks(prev => [...prev.filter(p => !d.tasks.some(x => x.id === p.id)), ...d.tasks]);
      for (const tr of d.tracks) {
        const {id, ...body} = tr;
        await write('tracks', id, body as unknown as Record<string, unknown>);
      }
      for (const tk of d.tasks) {
        const {id, ...body} = tk;
        await write('tasks', id, body as unknown as Record<string, unknown>);
      }
    },
    [write],
  );

  const loadExamples = useCallback(() => importData(exampleData()), [importData]);
  const clearError = useCallback(() => setError(null), []);

  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [tracks],
  );

  return {
    mode, canWrite, isStale, error, tracks: sortedTracks, tasks,
    saveTrack, deleteTrack, saveTask, deleteTask, loadExamples, importData, clearError,
  };
}
