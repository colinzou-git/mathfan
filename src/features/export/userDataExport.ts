import { buildSnapshot, type AppSnapshot } from '../sync/snapshot';
import { ADAPTIVE_SELECTOR_VERSION, CARD_MODEL_VERSION, DAILY_LESSON_PLANNER_VERSION, GOAL_PORTFOLIO_VERSION, RESPONSE_POLICY_VERSION } from '../learning/schedulingTelemetry';
import { FSRS_CONFIG_VERSION } from '../scheduler/fsrsAdapter';

export type UserDataExportFormat = 'json' | 'zip';
export type UserDataExportDelivery = 'download' | 'share';

export interface UserDataExportMetadata {
  exportSchemaVersion: 1;
  exportedAt: string;
  exportMode: 'local';
  profileScope: 'all';
  privacyMode: 'raw';
  source: 'indexeddb';
  format: UserDataExportFormat;
  appVersion: string;
  gitSha: string;
  buildTime: string;
  snapshotVersion: AppSnapshot['snapshotVersion'];
  tableCounts: Record<SnapshotTableName, number>;
  modelVersions: Record<string, string>;
}

export interface UserDataExportPayload {
  exportMetadata: UserDataExportMetadata;
  snapshot: AppSnapshot;
}

export interface UserDataExportResult {
  ok: boolean;
  filename?: string;
  format?: UserDataExportFormat;
  delivery?: UserDataExportDelivery;
  error?: string;
}

export interface PreparedUserDataExport {
  filename: string;
  format: UserDataExportFormat;
  blob: Blob;
  file: File | null;
}

export type PrepareUserDataExportResult =
  | { ok: true; artifact: PreparedUserDataExport }
  | { ok: false; format: UserDataExportFormat; error: string };

export type SharePreparedExportResult =
  | { status: 'shared' }
  | { status: 'dismissed' }
  | { status: 'unavailable'; message: string }
  | { status: 'failed'; message: string };

export type SnapshotTableName =
  | 'students'
  | 'itemStates'
  | 'attempts'
  | 'sessions'
  | 'multFactStats'
  | 'quizSessions'
  | 'mathAnswerEvents'
  | 'learningGoals'
  | 'goalEvents'
  | 'goalEvaluations';

interface SnapshotTable {
  name: SnapshotTableName;
  csvName: string;
  rows: Record<string, unknown>[];
}

export interface ExportArtifact {
  blob: Blob;
  filename: string;
}

export const OBJECT_URL_REVOKE_DELAY_MS = 60_000;
const MAX_PENDING_OBJECT_URLS = 8;
const pendingObjectUrls = new Map<string, number>();

const TABLE_FILES: ReadonlyArray<[SnapshotTableName, string]> = [
  ['students', 'students.csv'],
  ['itemStates', 'item-states.csv'],
  ['attempts', 'attempts.csv'],
  ['sessions', 'sessions.csv'],
  ['multFactStats', 'multiplication-fact-stats.csv'],
  ['quizSessions', 'quiz-sessions.csv'],
  ['mathAnswerEvents', 'math-answer-events.csv'],
  ['learningGoals', 'learning-goals.csv'],
  ['goalEvents', 'goal-events.csv'],
  ['goalEvaluations', 'goal-evaluations.csv'],
];

export function getSnapshotTables(snapshot: AppSnapshot): SnapshotTable[] {
  return TABLE_FILES.map(([name, csvName]) => ({
    name,
    csvName,
    rows: ((snapshot[name] ?? []) as unknown[]).map(row => row as Record<string, unknown>),
  }));
}

export function buildExportMetadata(
  snapshot: AppSnapshot,
  format: UserDataExportFormat,
  exportedAt = new Date(),
): UserDataExportMetadata {
  const tableCounts = Object.fromEntries(
    getSnapshotTables(snapshot).map(table => [table.name, table.rows.length]),
  ) as Record<SnapshotTableName, number>;

  return {
    exportSchemaVersion: 1,
    exportedAt: exportedAt.toISOString(),
    exportMode: 'local',
    profileScope: 'all',
    privacyMode: 'raw',
    source: 'indexeddb',
    format,
    appVersion: __APP_VERSION__,
    gitSha: __GIT_SHA__,
    buildTime: __BUILD_TIME__,
    snapshotVersion: snapshot.snapshotVersion,
    tableCounts,
    modelVersions: {
      cardModel: CARD_MODEL_VERSION, responsePolicy: RESPONSE_POLICY_VERSION,
      adaptiveSelector: ADAPTIVE_SELECTOR_VERSION, dailyLessonPlanner: DAILY_LESSON_PLANNER_VERSION,
      goalPortfolio: GOAL_PORTFOLIO_VERSION, fsrsConfig: FSRS_CONFIG_VERSION,
    },
  };
}

export function buildExportPayload(
  snapshot: AppSnapshot,
  metadata: UserDataExportMetadata,
): UserDataExportPayload {
  return { exportMetadata: metadata, snapshot };
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
}

export function formatExportFilename(date: Date, format: UserDataExportFormat): string {
  const p = (value: number) => String(value).padStart(2, '0');
  const timestamp = [
    date.getFullYear(),
    p(date.getMonth() + 1),
    p(date.getDate()),
    '-',
    p(date.getHours()),
    p(date.getMinutes()),
    p(date.getSeconds()),
  ].join('');
  return `${safeFilenamePart('mathfan-user-data')}-${safeFilenamePart(timestamp)}.${format}`;
}

export function serializePrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsvCell(value: unknown): string {
  const text = csvValue(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Empty row sets are represented by an empty file because no stable columns exist. */
export function serializeCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
  const lines = [
    columns.map(escapeCsvCell).join(','),
    ...rows.map(row => columns.map(column => escapeCsvCell(row[column])).join(',')),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

export function createJsonArtifact(payload: UserDataExportPayload, filename: string): ExportArtifact {
  return {
    blob: new Blob([serializePrettyJson(payload)], { type: 'application/json' }),
    filename,
  };
}

export async function createZipArtifact(
  payload: UserDataExportPayload,
  filename: string,
): Promise<ExportArtifact> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const rootName = filename.replace(/\.zip$/i, '');
  const root = zip.folder(rootName);
  if (!root) throw new Error('Could not create ZIP folder');

  const tables = getSnapshotTables(payload.snapshot);
  const archiveFiles = [
    'manifest.json',
    'mathfan-user-data.json',
    ...tables.map(table => `csv/${table.csvName}`),
    'csv/scheduling-telemetry.csv',
  ];
  const manifest = {
    exportMetadata: payload.exportMetadata,
    files: archiveFiles,
    rowCounts: payload.exportMetadata.tableCounts,
  };

  root.file('manifest.json', serializePrettyJson(manifest));
  root.file('mathfan-user-data.json', serializePrettyJson(payload));
  const csvFolder = root.folder('csv');
  if (!csvFolder) throw new Error('Could not create CSV folder');
  for (const table of tables) csvFolder.file(table.csvName, serializeCsv(table.rows));
  const telemetryRows = (payload.snapshot.mathAnswerEvents ?? [])
    .filter(event => event.schedulingTelemetry)
    .map(event => ({ eventId: event.id, ...event.schedulingTelemetry } as unknown as Record<string, unknown>));
  csvFolder.file('scheduling-telemetry.csv', serializeCsv(telemetryRows));

  return {
    blob: await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' }),
    filename,
  };
}

export function isStandaloneDisplayMode(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function asFile(artifact: ExportArtifact): File | null {
  if (typeof File === 'undefined') return null;
  return new File([artifact.blob], artifact.filename, {
    type: artifact.blob.type,
    lastModified: Date.now(),
  });
}

function revokeObjectUrl(url: string): void {
  const timer = pendingObjectUrls.get(url);
  if (timer === undefined) return;
  window.clearTimeout(timer);
  pendingObjectUrls.delete(url);
  URL.revokeObjectURL(url);
}

function scheduleObjectUrlRevocation(url: string, delayMs: number): void {
  if (pendingObjectUrls.size >= MAX_PENDING_OBJECT_URLS) {
    const oldest = pendingObjectUrls.keys().next().value as string | undefined;
    if (oldest) revokeObjectUrl(oldest);
  }
  const timer = window.setTimeout(() => revokeObjectUrl(url), delayMs);
  pendingObjectUrls.set(url, timer);
}

export function downloadBlobArtifact(
  artifact: ExportArtifact,
  revokeDelayMs = OBJECT_URL_REVOKE_DELAY_MS,
): UserDataExportDelivery {
  const url = URL.createObjectURL(artifact.blob);
  let anchor: HTMLAnchorElement | null = null;
  try {
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    anchor?.remove();
  }
  scheduleObjectUrlRevocation(url, revokeDelayMs);
  return 'download';
}

function readableError(stage: 'snapshot' | 'json' | 'zip' | 'delivery'): string {
  if (stage === 'snapshot') return 'Could not read the data stored on this device. Please try again.';
  if (stage === 'json') return 'Could not create the JSON export. Please try again.';
  if (stage === 'zip') return 'Could not create the ZIP export. Please try again.';
  return 'Could not save the export file. Please check your browser permissions and try again.';
}

export async function prepareUserDataExport(format: UserDataExportFormat): Promise<PrepareUserDataExportResult> {
  let snapshot: AppSnapshot;
  try {
    snapshot = await buildSnapshot();
  } catch (error) {
    console.error('[MathFan export] IndexedDB snapshot read failed.', error);
    return { ok: false, format, error: readableError('snapshot') };
  }

  const now = new Date();
  const filename = formatExportFilename(now, format);
  const payload = buildExportPayload(snapshot, buildExportMetadata(snapshot, format, now));
  let artifact: ExportArtifact;
  try {
    artifact = format === 'json'
      ? createJsonArtifact(payload, filename)
      : await createZipArtifact(payload, filename);
  } catch (error) {
    console.error(`[MathFan export] ${format.toUpperCase()} generation failed.`, error);
    return { ok: false, format, error: readableError(format) };
  }

  return {
    ok: true,
    artifact: {
      ...artifact,
      format,
      file: asFile(artifact),
    },
  };
}

export function canShareExportArtifact(artifact: PreparedUserDataExport): boolean {
  if (!isStandaloneDisplayMode() || artifact.file === null || typeof navigator.share !== 'function') return false;
  try {
    return navigator.canShare?.({ files: [artifact.file] }) === true;
  } catch {
    return false;
  }
}

export function classifyShareError(error: unknown): SharePreparedExportResult {
  if (error instanceof DOMException) {
    if (error.name === 'AbortError') return { status: 'dismissed' };
    if (error.name === 'NotAllowedError') {
      return { status: 'failed', message: 'Sharing was blocked by the browser. Tap Download Instead.' };
    }
    if (error.name === 'DataError' || error.name === 'TypeError') {
      return { status: 'failed', message: 'This browser could not share the generated file. Tap Download Instead.' };
    }
    return { status: 'failed', message: 'Could not share the export. Download the file instead.' };
  }

  console.error('[MathFan export] Web Share failed.', error);
  return { status: 'failed', message: 'Could not share the export. Download the file instead.' };
}

export async function sharePreparedExport(
  artifact: PreparedUserDataExport,
): Promise<SharePreparedExportResult> {
  if (!canShareExportArtifact(artifact) || !artifact.file) {
    return {
      status: 'unavailable',
      message: 'Sharing is not available on this device. Download the file instead.',
    };
  }

  try {
    await navigator.share({ files: [artifact.file], title: 'MathFan user data export' });
    return { status: 'shared' };
  } catch (error) {
    return classifyShareError(error);
  }
}

export function downloadPreparedExport(artifact: PreparedUserDataExport): UserDataExportResult {
  try {
    downloadBlobArtifact(artifact);
    return { ok: true, format: artifact.format, filename: artifact.filename, delivery: 'download' };
  } catch (error) {
    console.error('[MathFan export] File delivery failed.', error);
    return {
      ok: false,
      format: artifact.format,
      filename: artifact.filename,
      error: readableError('delivery'),
    };
  }
}

/** Convenience path for callers that always want a normal browser download. */
export async function exportUserData(format: UserDataExportFormat): Promise<UserDataExportResult> {
  const prepared = await prepareUserDataExport(format);
  if (!prepared.ok) return prepared;
  return downloadPreparedExport(prepared.artifact);
}
