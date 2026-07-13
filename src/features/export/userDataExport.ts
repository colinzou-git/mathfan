import { buildSnapshot, type AppSnapshot } from '../sync/snapshot';

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
  cancelled?: boolean;
  error?: string;
}

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

interface ExportArtifact {
  blob: Blob;
  filename: string;
}

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

  return {
    blob: await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' }),
    filename,
  };
}

function isStandalone(): boolean {
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

export async function deliverExportFile(artifact: ExportArtifact): Promise<UserDataExportDelivery | 'cancelled'> {
  const file = asFile(artifact);
  if (isStandalone() && file && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'MathFan user data export' });
      return 'share';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      console.error('[MathFan export] Web Share failed; falling back to download.', error);
    }
  }

  const url = URL.createObjectURL(artifact.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.style.display = 'none';
  try {
    document.body.appendChild(anchor);
    anchor.click();
    return 'download';
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

function readableError(stage: 'snapshot' | 'json' | 'zip' | 'delivery'): string {
  if (stage === 'snapshot') return 'Could not read the data stored on this device. Please try again.';
  if (stage === 'json') return 'Could not create the JSON export. Please try again.';
  if (stage === 'zip') return 'Could not create the ZIP export. Please try again.';
  return 'Could not save the export file. Please check your browser permissions and try again.';
}

export async function exportUserData(format: UserDataExportFormat): Promise<UserDataExportResult> {
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

  try {
    const delivery = await deliverExportFile(artifact);
    if (delivery === 'cancelled') {
      return { ok: false, format, filename, cancelled: true, error: 'Export cancelled.' };
    }
    return { ok: true, format, filename, delivery };
  } catch (error) {
    console.error('[MathFan export] File delivery failed.', error);
    return { ok: false, format, filename, error: readableError('delivery') };
  }
}
