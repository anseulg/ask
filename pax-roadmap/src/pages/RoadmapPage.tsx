/**
 * PAX 로드맵 — track-by-track roadmap with task management.
 *
 * Scaffolded from the Astryx `dashboard-progress` template; keeps its frame
 * (root Layout, divided header, full-bleed Sections with a 1440px column):
 *
 *   header (title, today, add task / add track, import·export)
 *   | filter bar (status, track, search)
 *   | summary tiles (total, in progress, done, overdue, average progress)
 *   | track overview cards (progress, status counts, next due)
 *   | timeline: start → target bar per task, colored by status, today line
 *   | per-track task tables (status, progress, start / target / done, D-day,
 *     edit and delete)
 */

import {useMemo, useState, type CSSProperties} from 'react';
import * as stylex from '@stylexjs/stylex';
import {VStack, HStack, Layout, LayoutContent, LayoutHeader} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {Section} from '@astryxdesign/core/Section';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Selector} from '@astryxdesign/core/Selector';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {
  BarChart, Bar, Cell, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, ArrowsRightLeftIcon, MapIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {StopIcon} from '@heroicons/react/24/solid';
import {
  useRoadmapStore, todayISO, dayNumber, isoFromDay, daysLeft, isOverdue,
  type Status, type Task, type Track, type RoadmapStore,
} from '../store';

// ============= LABELS & TONES =============

const STATUS_ORDER: Status[] = ['inProgress', 'atRisk', 'planned', 'hold', 'done'];

const STATUS_LABEL: Record<Status, string> = {
  planned: '예정',
  inProgress: '진행중',
  atRisk: '지연 위험',
  done: '완료',
  hold: '보류',
};

const STATUS_BADGE: Record<Status, 'neutral' | 'blue' | 'orange' | 'green' | 'purple'> = {
  planned: 'neutral',
  inProgress: 'blue',
  atRisk: 'orange',
  done: 'green',
  hold: 'purple',
};

const STATUS_BAR: Record<Status, 'neutral' | 'accent' | 'warning' | 'success'> = {
  planned: 'neutral',
  inProgress: 'accent',
  atRisk: 'warning',
  done: 'success',
  hold: 'neutral',
};

// Chart fills use the data-viz palette so one status is one color everywhere.
const STATUS_FILL: Record<Status, string> = {
  planned: 'var(--color-data-neutral, #8494A3)',
  inProgress: 'var(--color-data-categorical-blue, #0171E3)',
  atRisk: 'var(--color-data-categorical-orange, #EB6E00)',
  done: 'var(--color-data-categorical-green, #0B991F)',
  hold: 'var(--color-data-categorical-purple, #8A4FE8)',
};

const CHART_GRID = 'var(--color-border, rgba(5, 54, 89, 0.1))';
const CHART_LABEL = 'var(--color-text-secondary, #4E606F)';
const CHART_TODAY = 'var(--color-data-categorical-red, #F5394F)';
const AXIS_TICK = {fontSize: 'var(--font-size-sm, 12px)', fill: CHART_LABEL};

type StatusFilter = 'all' | 'active' | 'late' | Status;

const pageStyles = stylex.create({
  contentBottomPad: {paddingBlockEnd: 'var(--spacing-10)'},
  contentColumn: {width: '100%', maxWidth: 1440, marginInline: 'auto'},
  filterField: {minWidth: 180, flexGrow: 1, maxWidth: 320},
  chartScroll: {overflowX: 'auto', width: '100%'},
  chartInner: {minWidth: 640},
  tableInner: {minWidth: 960},
});

// ============= SMALL PIECES =============

function fmtDate(iso: string): string {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${y.slice(2)}.${m}.${d}`;
}

function DDay({task, today}: {task: Task; today: string}) {
  if (task.status === 'done') {
    const late = task.doneDate && task.targetDate && task.doneDate > task.targetDate;
    return <Badge variant={late ? 'yellow' : 'green'} label={late ? '지연 완료' : '완료'} />;
  }
  if (task.status === 'hold') return <Badge variant="neutral" label="보류 중" />;
  const d = daysLeft(task, today);
  if (d === null) return <Text color="secondary">–</Text>;
  if (d < 0) return <Badge variant="red" label={`D+${-d} 지연`} />;
  if (d === 0) return <Badge variant="orange" label="D-Day" />;
  return <Badge variant={d <= 7 ? 'yellow' : 'neutral'} label={`D-${d}`} />;
}

function LegendDot({color, label}: {color: string; label: string}) {
  const style: CSSProperties = {color};
  return (
    <HStack gap={2} vAlign="center">
      <Icon icon={StopIcon} size="xsm" style={style} />
      <Text type="supporting" color="secondary">{label}</Text>
    </HStack>
  );
}

function SectionHeading({title, hint, end}: {title: string; hint?: string; end?: React.ReactNode}) {
  return (
    <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
      <VStack gap={1}>
        <Heading level={2}>{title}</Heading>
        {hint ? <Text type="supporting" color="secondary">{hint}</Text> : null}
      </VStack>
      {end}
    </HStack>
  );
}

function avgProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round(tasks.reduce((s, t) => s + (t.status === 'done' ? 100 : t.progress), 0) / tasks.length);
}

// ============= HEADER =============

function RoadmapHeader({
  today, store, onAddTask, onAddTrack, onTransfer,
}: {
  today: string;
  store: RoadmapStore;
  onAddTask: () => void;
  onAddTrack: () => void;
  onTransfer: () => void;
}) {
  const late = store.tasks.filter(t => isOverdue(t, today)).length;
  return (
    <LayoutHeader padding={6} hasDivider>
      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap" xstyle={pageStyles.contentColumn}>
        <VStack gap={1}>
          <Heading level={1}>PAX 로드맵</Heading>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text color="secondary">기준일 {fmtDate(today)} · 트랙 {store.tracks.length}개 · 과제 {store.tasks.length}개</Text>
            {late > 0 ? (
              <Badge variant="red" label={`지연 ${late}건`} icon={<Icon icon={ExclamationTriangleIcon} size="sm" />} />
            ) : store.tasks.length > 0 ? (
              <Badge variant="green" label="지연 없음" />
            ) : null}
          </HStack>
        </VStack>
        <HStack gap={2} wrap="wrap">
          <Button
            label="가져오기·내보내기"
            variant="ghost"
            icon={<Icon icon={ArrowsRightLeftIcon} size="sm" />}
            onClick={onTransfer}
          />
          {store.canWrite ? (
            <>
              <Button label="트랙 추가" variant="secondary" onClick={onAddTrack} />
              <Button
                label="과제 추가"
                variant="primary"
                icon={<Icon icon={PlusIcon} size="sm" />}
                onClick={onAddTask}
                isDisabled={store.tracks.length === 0}
              />
            </>
          ) : null}
        </HStack>
      </HStack>
    </LayoutHeader>
  );
}

// ============= SUMMARY =============

function SummaryTiles({tasks, today}: {tasks: Task[]; today: string}) {
  const count = (s: Status) => tasks.filter(t => t.status === s).length;
  const late = tasks.filter(t => isOverdue(t, today)).length;
  const avg = avgProgress(tasks);
  const tiles: Array<{label: string; value: string; hint: string}> = [
    {label: '전체 과제', value: String(tasks.length), hint: `예정 ${count('planned')} · 보류 ${count('hold')}`},
    {label: '진행중', value: String(count('inProgress') + count('atRisk')), hint: `지연 위험 ${count('atRisk')}건 포함`},
    {label: '완료', value: String(count('done')), hint: tasks.length ? `완료율 ${Math.round((count('done') / tasks.length) * 100)}%` : '–'},
    {label: '목표일 지남', value: String(late), hint: late ? '완료되지 않은 과제' : '모두 일정 내'},
    {label: '평균 진행률', value: `${avg}%`, hint: '완료 과제는 100%로 계산'},
  ];
  return (
    <Grid gap={3} columns={{minWidth: 150, max: 5}}>
      {tiles.map(t => (
        <Card key={t.label} padding={5}>
          <VStack gap={1}>
            <Text type="supporting" color="secondary">{t.label}</Text>
            <Text type="display-3" weight="semibold">{t.value}</Text>
            <Text type="supporting" color="secondary">{t.hint}</Text>
          </VStack>
        </Card>
      ))}
    </Grid>
  );
}

// ============= TRACK OVERVIEW =============

function TrackCard({track, tasks, today}: {track: Track; tasks: Task[]; today: string}) {
  const avg = avgProgress(tasks);
  const late = tasks.filter(t => isOverdue(t, today)).length;
  const next = tasks
    .filter(t => t.status !== 'done' && t.status !== 'hold' && t.targetDate)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
  return (
    <Card padding={5}>
      <VStack gap={4}>
        <VStack gap={1}>
          <HStack hAlign="between" vAlign="center" gap={2}>
            <Heading level={3} accessibilityLevel={3}>{track.name}</Heading>
            {late > 0 ? <Badge variant="red" label={`지연 ${late}`} /> : null}
          </HStack>
          <Text type="supporting" color="secondary">
            {track.owner ? `${track.owner} · ` : ''}{track.goal || '목표 미입력'}
          </Text>
        </VStack>
        <ProgressBar
          label={`${track.name} 진행률`}
          value={avg}
          hasValueLabel
          isLabelHidden
          variant={late > 0 ? 'warning' : avg === 100 ? 'success' : 'accent'}
        />
        <HStack gap={2} wrap="wrap">
          {STATUS_ORDER.map(s => {
            const n = tasks.filter(t => t.status === s).length;
            return n ? <Badge key={s} variant={STATUS_BADGE[s]} label={`${STATUS_LABEL[s]} ${n}`} /> : null;
          })}
          {tasks.length === 0 ? <Text type="supporting" color="secondary">아직 과제가 없습니다</Text> : null}
        </HStack>
        <Text type="supporting" color="secondary">
          {next ? `다음 마감: ${next.title} · ${fmtDate(next.targetDate)}` : '남은 마감 없음'}
        </Text>
      </VStack>
    </Card>
  );
}

// ============= TIMELINE =============

interface GanttRow extends Task {
  label: string;
  offset: number;
  duration: number;
  trackName: string;
}

function GanttTooltip({active, payload}: {active?: boolean; payload?: Array<{payload: GanttRow}>}) {
  if (!active || !payload?.length) return null;
  const r = payload[payload.length - 1].payload;
  return (
    <Card padding={3}>
      <VStack gap={1}>
        <Text weight="semibold">{r.title}</Text>
        <Text type="supporting" color="secondary">{r.trackName} · {r.owner || '담당 미정'}</Text>
        <Text type="supporting" color="secondary">
          착수 {fmtDate(r.startDate)} → 목표 {fmtDate(r.targetDate)}{r.doneDate ? ` · 완료 ${fmtDate(r.doneDate)}` : ''}
        </Text>
        <Text type="supporting">{STATUS_LABEL[r.status]} · {r.status === 'done' ? 100 : r.progress}%</Text>
      </VStack>
    </Card>
  );
}

function Timeline({tracks, tasks, today}: {tracks: Track[]; tasks: Task[]; today: string}) {
  const dated = tasks.filter(t => t.startDate && t.targetDate);
  if (dated.length === 0) {
    return (
      <EmptyState
        title="표시할 일정이 없습니다"
        description="착수일과 목표일이 있는 과제가 여기에 막대로 표시됩니다."
        icon={<Icon icon={MapIcon} size="lg" />}
        isCompact
      />
    );
  }
  const todayN = dayNumber(today);
  const ends = dated.map(t => dayNumber(t.doneDate && t.doneDate > t.targetDate ? t.doneDate : t.targetDate));
  const lo = Math.min(todayN, ...dated.map(t => dayNumber(t.startDate)));
  const hi = Math.max(todayN, ...ends);
  // Snap the domain to whole months so ticks fall on the 1st.
  const loDate = new Date(lo * 86_400_000);
  const d0 = Math.round(Date.UTC(loDate.getUTCFullYear(), loDate.getUTCMonth(), 1) / 86_400_000);
  const hiDate = new Date(hi * 86_400_000);
  const d1 = Math.round(Date.UTC(hiDate.getUTCFullYear(), hiDate.getUTCMonth() + 1, 1) / 86_400_000);
  const ticks: number[] = [];
  for (let y = loDate.getUTCFullYear(), m = loDate.getUTCMonth(); ; m++) {
    const n = Math.round(Date.UTC(y, m, 1) / 86_400_000);
    if (n > d1) break;
    ticks.push(n - d0);
  }
  const trackOrder = new Map(tracks.map((t, i) => [t.id, i]));
  const trackName = new Map(tracks.map(t => [t.id, t.name]));
  const rows: GanttRow[] = [...dated]
    .sort((a, b) =>
      (trackOrder.get(a.trackId) ?? 99) - (trackOrder.get(b.trackId) ?? 99) ||
      a.startDate.localeCompare(b.startDate))
    .map(t => {
      const s = dayNumber(t.startDate);
      const e = dayNumber(t.status === 'done' && t.doneDate ? t.doneDate : t.targetDate);
      return {
        ...t,
        label: t.title.length > 16 ? `${t.title.slice(0, 15)}…` : t.title,
        offset: s - d0,
        duration: Math.max(1, e - s),
        trackName: trackName.get(t.trackId) ?? '',
      };
    });
  const height = Math.max(160, rows.length * 36 + 40);
  return (
    <VStack gap={3}>
      <VStack xstyle={pageStyles.chartScroll}>
        <VStack xstyle={pageStyles.chartInner}>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={rows} layout="vertical" margin={{top: 16, right: 16, left: 8, bottom: 4}} barCategoryGap={8}>
              <CartesianGrid horizontal={false} vertical stroke={CHART_GRID} />
              <XAxis
                type="number"
                domain={[0, d1 - d0]}
                ticks={ticks}
                tickFormatter={(v: number) => {
                  const iso = isoFromDay(v + d0);
                  return `${Number(iso.slice(5, 7))}월`;
                }}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                allowDataOverflow
              />
              <YAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} width={140} />
              <Tooltip content={<GanttTooltip />} cursor={{fill: CHART_GRID}} />
              <ReferenceLine
                x={todayN - d0}
                stroke={CHART_TODAY}
                strokeDasharray="4 4"
                label={{value: '오늘', position: 'top', fontSize: 11, fill: CHART_TODAY}}
              />
              <Bar dataKey="offset" stackId="g" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="duration" stackId="g" radius={4} isAnimationActive={false}>
                {rows.map(r => (
                  <Cell key={r.id} fill={STATUS_FILL[r.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </VStack>
      </VStack>
      <HStack gap={4} vAlign="center" wrap="wrap">
        {STATUS_ORDER.map(s => <LegendDot key={s} color={STATUS_FILL[s]} label={STATUS_LABEL[s]} />)}
        <Text type="supporting" color="secondary">막대: 착수일 → 목표일 (완료 과제는 실제 완료일까지)</Text>
      </HStack>
    </VStack>
  );
}

// ============= TASK TABLE =============

function taskColumns(
  today: string,
  canWrite: boolean,
  onEdit: (t: Task) => void,
  onDelete: (t: Task) => void,
): TableColumn<Task & Record<string, unknown>>[] {
  const cols: TableColumn<Task & Record<string, unknown>>[] = [
    {
      key: 'title',
      header: '과제',
      width: proportional(3, {minWidth: 200}),
      renderCell: t => (
        <VStack gap={0}>
          <Text weight="semibold">{t.title}</Text>
          {t.note ? <Text type="supporting" color="secondary" maxLines={2}>{t.note}</Text> : null}
        </VStack>
      ),
    },
    {
      key: 'owner',
      header: '담당',
      width: proportional(1, {minWidth: 96}),
      renderCell: t => <Text>{t.owner || '–'}</Text>,
    },
    {
      key: 'status',
      header: '상태',
      width: proportional(1, {minWidth: 96}),
      renderCell: t => <Badge variant={STATUS_BADGE[t.status]} label={STATUS_LABEL[t.status]} />,
    },
    {
      key: 'progress',
      header: '진행률',
      width: proportional(2, {minWidth: 140}),
      renderCell: t => {
        const v = t.status === 'done' ? 100 : t.progress;
        return (
          <ProgressBar
            label={`${t.title} 진행률`}
            value={v}
            hasValueLabel
            isLabelHidden
            variant={isOverdue(t, today) ? 'error' : STATUS_BAR[t.status]}
          />
        );
      },
    },
    {key: 'startDate', header: '착수일', width: proportional(1, {minWidth: 88}), renderCell: t => <Text>{fmtDate(t.startDate)}</Text>},
    {key: 'targetDate', header: '목표일', width: proportional(1, {minWidth: 88}), renderCell: t => <Text>{fmtDate(t.targetDate)}</Text>},
    {key: 'doneDate', header: '완료일', width: proportional(1, {minWidth: 88}), renderCell: t => <Text>{fmtDate(t.doneDate)}</Text>},
    {key: 'dday', header: '일정', width: proportional(1, {minWidth: 96}), renderCell: t => <DDay task={t} today={today} />},
  ];
  if (canWrite) {
    cols.push({
      key: 'actions',
      header: '관리',
      width: proportional(1, {minWidth: 96}),
      renderCell: t => (
        <HStack gap={1}>
          <IconButton label={`${t.title} 수정`} variant="ghost" size="sm" icon={<Icon icon={PencilSquareIcon} />} onClick={() => onEdit(t)} />
          <IconButton label={`${t.title} 삭제`} variant="ghost" size="sm" icon={<Icon icon={TrashIcon} />} onClick={() => onDelete(t)} />
        </HStack>
      ),
    });
  }
  return cols;
}

function TrackTasks({
  track, tasks, allCount, today, canWrite, onEdit, onDelete, onAdd, onEditTrack,
}: {
  track: Track;
  tasks: Task[];
  allCount: number;
  today: string;
  canWrite: boolean;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onAdd: (trackId: string) => void;
  onEditTrack: (t: Track) => void;
}) {
  const columns = useMemo(() => taskColumns(today, canWrite, onEdit, onDelete), [today, canWrite, onEdit, onDelete]);
  const sorted = [...tasks].sort(
    (a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || (a.targetDate || '9').localeCompare(b.targetDate || '9'),
  );
  return (
    <Card padding={5}>
      <VStack gap={4}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Heading level={3} accessibilityLevel={3}>{track.name}</Heading>
            <Text type="supporting" color="secondary">
              {tasks.length === allCount ? `과제 ${allCount}개` : `과제 ${tasks.length}/${allCount}개 표시`} · 평균 {avgProgress(tasks)}%
            </Text>
          </HStack>
        <VStack gap={3}>
          {sorted.length === 0 ? (
            <EmptyState
              title={allCount === 0 ? '이 트랙에 과제가 없습니다' : '조건에 맞는 과제가 없습니다'}
              description={allCount === 0 ? '과제를 추가하면 상태·진행률·일정이 여기에 표시됩니다.' : '필터를 바꿔 보세요.'}
              isCompact
            />
          ) : (
            <VStack xstyle={pageStyles.chartScroll}>
              <VStack xstyle={pageStyles.tableInner}>
                <Table<Task & Record<string, unknown>>
                  data={sorted as Array<Task & Record<string, unknown>>}
                  columns={columns}
                  idKey="id"
                  density="balanced"
                  dividers="rows"
                  hasHover
                />
              </VStack>
            </VStack>
          )}
          {canWrite ? (
            <HStack gap={2}>
              <Button label="이 트랙에 과제 추가" variant="ghost" size="sm" icon={<Icon icon={PlusIcon} size="sm" />} onClick={() => onAdd(track.id)} />
              <Button label="트랙 정보 수정" variant="ghost" size="sm" onClick={() => onEditTrack(track)} />
            </HStack>
          ) : null}
        </VStack>
      </VStack>
    </Card>
  );
}

// ============= DIALOGS =============

type ISO = React.ComponentProps<typeof DateInput>['value'];

type TaskDraft = Omit<Task, 'id' | 'updatedAt'> & {id?: string};

function TaskDialog({
  draft, tracks, today, onClose, onSave,
}: {
  draft: TaskDraft;
  tracks: Track[];
  today: string;
  onClose: () => void;
  onSave: (t: TaskDraft) => Promise<void>;
}) {
  const [d, setD] = useState<TaskDraft>(draft);
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setD(prev => ({...prev, [k]: v}));
  const setStatus = (s: Status) =>
    setD(prev => ({
      ...prev,
      status: s,
      progress: s === 'done' ? 100 : prev.progress === 100 ? 90 : prev.progress,
      doneDate: s === 'done' ? prev.doneDate || today : '',
    }));
  const dateError = d.startDate && d.targetDate && d.targetDate < d.startDate ? '목표일이 착수일보다 빠릅니다.' : '';
  const canSave = d.title.trim() && d.trackId && !dateError;
  return (
    <Dialog isOpen onOpenChange={o => (!o ? onClose() : undefined)} purpose="form" width={560}>
      <DialogHeader title={d.id ? '과제 수정' : '과제 추가'} onOpenChange={o => (!o ? onClose() : undefined)} />
      <form
        onSubmit={e => {
          e.preventDefault();
          if (canSave) void onSave({...d, title: d.title.trim(), owner: d.owner.trim()}).then(onClose, () => undefined);
        }}>
        <VStack gap={4} padding={6}>
          <TextInput label="과제명" value={d.title} onChange={v => set('title', v)} isRequired />
          <Grid gap={4} columns={{minWidth: 200, max: 2}}>
            <Selector
              label="트랙"
              value={d.trackId}
              onChange={v => set('trackId', v)}
              options={tracks.map(t => ({value: t.id, label: t.name}))}
            />
            <TextInput label="담당자" value={d.owner} onChange={v => set('owner', v)} isOptional />
            <Selector
              label="상태"
              value={d.status}
              onChange={v => setStatus(v as Status)}
              options={STATUS_ORDER.map(s => ({value: s, label: STATUS_LABEL[s]}))}
            />
            <NumberInput
              label="진행률 (%)"
              value={d.progress}
              min={0}
              max={100}
              step={5}
              onChange={v => set('progress', Math.max(0, Math.min(100, Math.round(v || 0))))}
              isDisabled={d.status === 'done'}
              disabledMessage="완료된 과제는 100%입니다"
            />
            <DateInput label="착수일" value={(d.startDate || undefined) as ISO} onChange={v => set('startDate', v ?? '')} format="date" hasClear />
            <DateInput label="목표 완료일" value={(d.targetDate || undefined) as ISO} onChange={v => set('targetDate', v ?? '')} format="date" hasClear />
            <DateInput
              label="실제 완료일"
              value={(d.doneDate || undefined) as ISO}
              onChange={v => set('doneDate', v ?? '')}
              format="date"
              hasClear
              isDisabled={d.status !== 'done'}
              disabledMessage="상태를 완료로 바꾸면 입력할 수 있습니다"
            />
          </Grid>
          {dateError ? <Banner status="error" title={dateError} /> : null}
          <TextArea label="메모 (이슈·다음 할 일)" value={d.note} onChange={v => set('note', v)} isOptional />
          <HStack gap={2} hAlign="end">
            <Button label="취소" variant="secondary" onClick={onClose} />
            <Button label="저장" variant="primary" type="submit" isDisabled={!canSave} />
          </HStack>
        </VStack>
      </form>
    </Dialog>
  );
}

type TrackDraft = {id?: string; name: string; owner: string; goal: string; order?: number};

function TrackDialog({
  draft, taskCount, onClose, onSave, onDelete,
}: {
  draft: TrackDraft;
  taskCount: number;
  onClose: () => void;
  onSave: (t: TrackDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [d, setD] = useState(draft);
  const [confirming, setConfirming] = useState(false);
  return (
    <Dialog isOpen onOpenChange={o => (!o ? onClose() : undefined)} purpose="form" width={480}>
      <DialogHeader title={d.id ? '트랙 수정' : '트랙 추가'} onOpenChange={o => (!o ? onClose() : undefined)} />
      <form
        onSubmit={e => {
          e.preventDefault();
          if (d.name.trim()) void onSave({...d, name: d.name.trim()}).then(onClose, () => undefined);
        }}>
        <VStack gap={4} padding={6}>
          <TextInput label="트랙 이름" value={d.name} onChange={v => setD({...d, name: v})} isRequired />
          <TextInput label="트랙 리드" value={d.owner} onChange={v => setD({...d, owner: v})} isOptional />
          <TextInput label="트랙 목표" value={d.goal} onChange={v => setD({...d, goal: v})} isOptional />
          {confirming ? (
            <Banner
              status="error"
              title="트랙을 삭제할까요?"
              description={taskCount ? `이 트랙의 과제 ${taskCount}개도 함께 삭제됩니다.` : '되돌릴 수 없습니다.'}
              endContent={
                <Button
                  label="삭제"
                  variant="destructive"
                  size="sm"
                  onClick={() => d.id && void onDelete(d.id).then(onClose, () => undefined)}
                />
              }
            />
          ) : null}
          <HStack gap={2} hAlign="between">
            {d.id && !confirming ? (
              <Button label="트랙 삭제" variant="ghost" onClick={() => setConfirming(true)} />
            ) : <VStack />}
            <HStack gap={2}>
              <Button label="취소" variant="secondary" onClick={onClose} />
              <Button label="저장" variant="primary" type="submit" isDisabled={!d.name.trim()} />
            </HStack>
          </HStack>
        </VStack>
      </form>
    </Dialog>
  );
}

function DeleteTaskDialog({task, onClose, onConfirm}: {task: Task; onClose: () => void; onConfirm: () => Promise<void>}) {
  return (
    <Dialog isOpen onOpenChange={o => (!o ? onClose() : undefined)} width={400}>
      <DialogHeader title="과제를 삭제할까요?" onOpenChange={o => (!o ? onClose() : undefined)} />
      <VStack gap={4} padding={6}>
        <Text>‘{task.title}’ 과제를 삭제합니다. 되돌릴 수 없습니다.</Text>
        <HStack gap={2} hAlign="end">
          <Button label="취소" variant="secondary" onClick={onClose} />
          <Button label="삭제" variant="destructive" clickAction={() => onConfirm().then(onClose, () => undefined)} />
        </HStack>
      </VStack>
    </Dialog>
  );
}

const CSV_HEAD = ['트랙', '과제', '담당', '상태', '진행률', '착수일', '목표일', '완료일', '메모'];

function TransferDialog({store, onClose}: {store: RoadmapStore; onClose: () => void}) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  const trackName = new Map(store.tracks.map(t => [t.id, t.name]));
  const csv = [CSV_HEAD, ...store.tasks.map(t => [
    trackName.get(t.trackId) ?? '', t.title, t.owner, STATUS_LABEL[t.status],
    String(t.status === 'done' ? 100 : t.progress), t.startDate, t.targetDate, t.doneDate, t.note,
  ])].map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
  const json = JSON.stringify({tracks: store.tracks, tasks: store.tasks}, null, 2);
  const copy = (s: string, label: string) =>
    navigator.clipboard.writeText(s).then(
      () => setMsg({ok: true, text: `${label}을(를) 복사했습니다.`}),
      () => {
        setText(s);
        setMsg({ok: false, text: '자동 복사가 막혀 아래 칸에 넣었습니다. 직접 선택해 복사해 주세요.'});
      },
    );
  const doImport = async () => {
    try {
      const parsed = JSON.parse(text) as {tracks?: Track[]; tasks?: Task[]};
      if (!Array.isArray(parsed.tracks) || !Array.isArray(parsed.tasks)) throw new Error('shape');
      await store.importData({tracks: parsed.tracks, tasks: parsed.tasks});
      setMsg({ok: true, text: `트랙 ${parsed.tracks.length}개, 과제 ${parsed.tasks.length}개를 가져왔습니다.`});
    } catch {
      setMsg({ok: false, text: '형식이 맞지 않습니다. 이 화면에서 복사한 JSON 형식({"tracks":[…],"tasks":[…]})을 붙여 주세요.'});
    }
  };
  return (
    <Dialog isOpen onOpenChange={o => (!o ? onClose() : undefined)} width={640} purpose="form">
      <DialogHeader title="가져오기·내보내기" onOpenChange={o => (!o ? onClose() : undefined)} />
      <VStack gap={4} padding={6}>
        <Text color="secondary">엑셀용 CSV나 백업용 JSON을 복사할 수 있습니다. JSON을 붙여 넣으면 같은 ID의 항목은 덮어쓰고 나머지는 추가합니다.</Text>
        <HStack gap={2} wrap="wrap">
          <Button label="CSV 복사 (엑셀)" variant="secondary" onClick={() => void copy(csv, 'CSV')} />
          <Button label="JSON 복사 (백업)" variant="secondary" onClick={() => void copy(json, 'JSON')} />
        </HStack>
        <TextArea label="JSON 붙여넣기" value={text} onChange={setText} rows={8} />
        {msg ? <Banner status={msg.ok ? 'success' : 'warning'} title={msg.text} /> : null}
        <HStack gap={2} hAlign="end">
          <Button label="닫기" variant="secondary" onClick={onClose} />
          {store.canWrite ? (
            <Button label="가져오기" variant="primary" isDisabled={!text.trim()} clickAction={doImport} />
          ) : null}
        </HStack>
      </VStack>
    </Dialog>
  );
}

// ============= MAIN =============

export default function RoadmapPage() {
  const store = useRoadmapStore();
  const today = todayISO();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [trackDraft, setTrackDraft] = useState<TrackDraft | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [transfer, setTransfer] = useState(false);

  const {tracks, tasks} = store;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(t => {
      if (trackFilter !== 'all' && t.trackId !== trackFilter) return false;
      if (statusFilter === 'active' && (t.status === 'done' || t.status === 'hold')) return false;
      if (statusFilter === 'late' && !isOverdue(t, today)) return false;
      if (statusFilter !== 'all' && statusFilter !== 'active' && statusFilter !== 'late' && t.status !== statusFilter) return false;
      if (q && !`${t.title} ${t.owner} ${t.note}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, trackFilter, statusFilter, query, today]);

  const visibleTracks = trackFilter === 'all' ? tracks : tracks.filter(t => t.id === trackFilter);
  const isFiltered = statusFilter !== 'all' || trackFilter !== 'all' || query.trim() !== '';

  const newTask = (trackId?: string) =>
    setTaskDraft({
      trackId: trackId ?? (trackFilter !== 'all' ? trackFilter : tracks[0]?.id ?? ''),
      title: '', owner: '', status: 'planned', progress: 0,
      startDate: today, targetDate: '', doneDate: '', note: '',
    });
  const editTask = (t: Task) => {
    const {updatedAt: _u, ...rest} = t;
    void _u;
    setTaskDraft(rest);
  };

  const empty = store.mode === 'shared' && tracks.length === 0 && !store.isStale;

  return (
    <Layout
      height="fill"
      header={
        <RoadmapHeader
          today={today}
          store={store}
          onAddTask={() => newTask()}
          onAddTrack={() => setTrackDraft({name: '', owner: '', goal: ''})}
          onTransfer={() => setTransfer(true)}
        />
      }
      content={
        <LayoutContent padding={0} xstyle={pageStyles.contentBottomPad}>
          {store.mode === 'local' || store.error || store.isStale || !store.canWrite ? (
            <Section padding={6} paddingBlock={4} dividers={['bottom']}>
              <VStack gap={2} xstyle={pageStyles.contentColumn}>
                {store.mode === 'local' ? (
                  <Banner status="info" title="예시 데이터입니다" description="이 화면에서는 저장소에 연결되지 않아 바꾼 내용이 저장되지 않습니다." />
                ) : null}
                {store.isStale ? (
                  <Banner status="warning" title="저장소 응답이 늦어지고 있습니다" description="보이는 내용이 최신이 아닐 수 있습니다." />
                ) : null}
                {!store.canWrite && store.mode === 'shared' ? (
                  <Banner status="info" title="보기 전용" description="수정하려면 소유자에게 편집 권한을 요청해 주세요." />
                ) : null}
                {store.error ? (
                  <Banner status="error" title={store.error} isDismissable onDismiss={store.clearError} />
                ) : null}
              </VStack>
            </Section>
          ) : null}

          {store.mode === 'loading' ? (
            <Section padding={6} paddingBlock={10}>
              <VStack gap={3} xstyle={pageStyles.contentColumn}>
                <ProgressBar label="로드맵 불러오는 중" isIndeterminate />
              </VStack>
            </Section>
          ) : empty ? (
            <Section padding={6} paddingBlock={10}>
              <VStack xstyle={pageStyles.contentColumn}>
                <EmptyState
                  title="아직 트랙이 없습니다"
                  description="트랙(예: 고객 경험, 업무 자동화)을 만들고 그 아래에 과제를 추가하세요. 각 과제에 상태·진행률·착수일·목표일·완료일을 기록하면 트랙별 현황과 타임라인이 자동으로 그려집니다."
                  icon={<Icon icon={MapIcon} size="lg" />}
                  headingLevel={2}
                  actions={
                    store.canWrite ? (
                      <HStack gap={2} wrap="wrap" hAlign="center">
                        <Button label="첫 트랙 추가" variant="primary" onClick={() => setTrackDraft({name: '', owner: '', goal: ''})} />
                        <Button label="예시 데이터로 시작" variant="secondary" clickAction={store.loadExamples} />
                      </HStack>
                    ) : undefined
                  }
                />
              </VStack>
            </Section>
          ) : (
            <>
              <Section padding={6} paddingBlock={4} dividers={['bottom']}>
                <HStack gap={3} vAlign="end" wrap="wrap" xstyle={pageStyles.contentColumn}>
                  <SegmentedControl label="상태 필터" value={statusFilter} onChange={v => setStatusFilter(v as StatusFilter)} size="sm">
                    <SegmentedControlItem label="전체" value="all" />
                    <SegmentedControlItem label="진행 중인 것" value="active" />
                    <SegmentedControlItem label="지연" value="late" />
                    <SegmentedControlItem label="예정" value="planned" />
                    <SegmentedControlItem label="완료" value="done" />
                    <SegmentedControlItem label="보류" value="hold" />
                  </SegmentedControl>
                  <VStack xstyle={pageStyles.filterField}>
                  <Selector
                    label="트랙"
                    isLabelHidden
                    size="sm"
                    value={trackFilter}
                    onChange={setTrackFilter}
                    options={[{value: 'all', label: '모든 트랙'}, ...tracks.map(t => ({value: t.id, label: t.name}))]}
                  />
                  </VStack>
                  <VStack xstyle={pageStyles.filterField}>
                  <TextInput
                    label="과제 검색"
                    isLabelHidden
                    type="search"
                    size="sm"
                    placeholder="과제·담당자·메모 검색"
                    value={query}
                    onChange={setQuery}
                  />
                  </VStack>
                  {isFiltered ? (
                    <Button
                      label="필터 초기화"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStatusFilter('all');
                        setTrackFilter('all');
                        setQuery('');
                      }}
                    />
                  ) : null}
                </HStack>
              </Section>

              <Section padding={6} paddingBlock={8} dividers={['bottom']}>
                <VStack gap={6} xstyle={pageStyles.contentColumn}>
                  <SectionHeading title="요약" hint={isFiltered ? `필터 적용 · 과제 ${filtered.length}개 기준` : '전체 과제 기준'} />
                  <SummaryTiles tasks={filtered} today={today} />
                  <SectionHeading title="트랙별 현황" hint="평균 진행률 · 상태별 과제 수 · 가장 가까운 마감" />
                  <Grid gap={4} columns={{minWidth: 280, max: 3}}>
                    {visibleTracks.map(tr => (
                      <TrackCard key={tr.id} track={tr} tasks={filtered.filter(t => t.trackId === tr.id)} today={today} />
                    ))}
                  </Grid>
                </VStack>
              </Section>

              <Section padding={6} paddingBlock={8} dividers={['bottom']}>
                <VStack gap={6} xstyle={pageStyles.contentColumn}>
                  <SectionHeading title="타임라인" hint="트랙 순서대로 과제를 나열 · 빨간 점선이 오늘" />
                  <Timeline tracks={tracks} tasks={filtered} today={today} />
                </VStack>
              </Section>

              <Section padding={6} paddingBlock={8}>
                <VStack gap={4} xstyle={pageStyles.contentColumn}>
                  <SectionHeading title="트랙별 과제" hint="미완료 과제를 목표일 순으로, 완료 과제는 아래에" />
                  {visibleTracks.map(tr => (
                    <TrackTasks
                      key={tr.id}
                      track={tr}
                      tasks={filtered.filter(t => t.trackId === tr.id)}
                      allCount={tasks.filter(t => t.trackId === tr.id).length}
                      today={today}
                      canWrite={store.canWrite}
                      onEdit={editTask}
                      onDelete={setDeleting}
                      onAdd={newTask}
                      onEditTrack={t => setTrackDraft(t)}
                    />
                  ))}
                </VStack>
              </Section>
            </>
          )}

          {taskDraft ? (
            <TaskDialog
              draft={taskDraft}
              tracks={tracks}
              today={today}
              onClose={() => setTaskDraft(null)}
              onSave={store.saveTask}
            />
          ) : null}
          {trackDraft ? (
            <TrackDialog
              draft={trackDraft}
              taskCount={trackDraft.id ? tasks.filter(t => t.trackId === trackDraft.id).length : 0}
              onClose={() => setTrackDraft(null)}
              onSave={store.saveTrack}
              onDelete={store.deleteTrack}
            />
          ) : null}
          {deleting ? (
            <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onConfirm={() => store.deleteTask(deleting.id)} />
          ) : null}
          {transfer ? <TransferDialog store={store} onClose={() => setTransfer(false)} /> : null}
        </LayoutContent>
      }
    />
  );
}
