import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSnapshot } from '../features/sync/snapshot';

const { buildSnapshotMock } = vi.hoisted(() => ({
  buildSnapshotMock: vi.fn(),
}));

vi.mock('../features/sync/snapshot', () => ({
  buildSnapshot: buildSnapshotMock,
}));

import {
  buildExportMetadata,
  buildExportPayload,
  createJsonArtifact,
  createZipArtifact,
  deliverExportFile,
  exportUserData,
  formatExportFilename,
  getSnapshotTables,
  serializeCsv,
  serializePrettyJson,
} from '../features/export/userDataExport';

function snapshot(): AppSnapshot {
  return {
    appId: 'mathfan',
    snapshotVersion: 2,
    snapshotAt: '2026-07-13T12:00:00.000Z',
    students: [
      {
        id: 'student-1',
        displayName: 'Alex Raw Name',
        gradeLevel: 3,
        timezone: 'UTC',
        createdAt: '2026-01-01T00:00:00.000Z',
        settings: {
          audioEnabled: true,
          speechRate: 1,
          dailyGoalMinutes: 10,
          sessionLength: 10,
          autoAdvance: true,
          theme: 'indigo',
          allowTimedMode: false,
          competitionModeEnabled: false,
          parentModeEnabled: false,
        },
      },
      {
        id: 'student-2',
        displayName: 'Sam, Jr.',
        gradeLevel: 4,
        timezone: 'UTC',
        createdAt: '2026-02-01T00:00:00.000Z',
        settings: {
          audioEnabled: false,
          speechRate: 1,
          dailyGoalMinutes: 10,
          sessionLength: 10,
          autoAdvance: false,
          theme: 'indigo',
          allowTimedMode: false,
          competitionModeEnabled: false,
          parentModeEnabled: false,
        },
      },
    ],
    itemStates: [],
    attempts: [],
    sessions: [],
    multFactStats: [],
    quizSessions: [],
    mathAnswerEvents: [],
    learningGoals: [],
    goalEvents: [],
    goalEvaluations: [],
  };
}

describe('user data export serialization', () => {
  it('preserves every snapshot table and raw profile identity in metadata and JSON', () => {
    const data = snapshot();
    const exportedAt = new Date('2026-07-13T12:34:56.000Z');
    const metadata = buildExportMetadata(data, 'json', exportedAt);
    const payload = buildExportPayload(data, metadata);
    const parsed = JSON.parse(serializePrettyJson(payload));

    expect(getSnapshotTables(data).map(table => table.name)).toEqual([
      'students', 'itemStates', 'attempts', 'sessions', 'multFactStats',
      'quizSessions', 'mathAnswerEvents', 'learningGoals', 'goalEvents', 'goalEvaluations',
    ]);
    expect(parsed.snapshot.students).toEqual(data.students);
    expect(parsed.snapshot.students[0]).toMatchObject({ id: 'student-1', displayName: 'Alex Raw Name' });
    expect(metadata).toMatchObject({
      exportSchemaVersion: 1,
      exportedAt: exportedAt.toISOString(),
      exportMode: 'local',
      profileScope: 'all',
      privacyMode: 'raw',
      source: 'indexeddb',
      format: 'json',
      appVersion: 'test',
      gitSha: 'testsha',
      buildTime: '2026-01-01T00:00:00.000Z',
      snapshotVersion: 2,
    });
    expect(metadata.tableCounts.students).toBe(2);
    expect(Object.values(metadata.tableCounts).reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(serializePrettyJson(payload)).toMatch(/\n$/);
  });

  it('formats deterministic local timestamps without Windows-unsafe characters', () => {
    const date = new Date(2026, 6, 13, 9, 8, 7);
    expect(formatExportFilename(date, 'json')).toBe('mathfan-user-data-20260713-090807.json');
    expect(formatExportFilename(date, 'zip')).not.toMatch(/[:\\/]/);
  });

  it('serializes deterministic RFC-4180-style CSV values', () => {
    const csv = serializeCsv([
      { z: null, a: 'comma,value', bool: true, number: 4, nested: { x: 'y' }, lines: 'a\r\nb', quote: 'say "hi"' },
    ]);
    expect(csv).toBe(
      'a,bool,lines,nested,number,quote,z\r\n' +
      '"comma,value",true,"a\r\nb","{""x"":""y""}",4,"say ""hi""",\r\n',
    );
    expect(serializeCsv([])).toBe('');
  });

  it('creates a ZIP with manifest, complete JSON, and every CSV table', async () => {
    const data = snapshot();
    const metadata = buildExportMetadata(data, 'zip', new Date('2026-07-13T12:34:56.000Z'));
    const artifact = await createZipArtifact(
      buildExportPayload(data, metadata),
      'mathfan-user-data-20260713-123456.zip',
    );
    const zip = await JSZip.loadAsync(await artifact.blob.arrayBuffer());
    const root = 'mathfan-user-data-20260713-123456/';

    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
      `${root}manifest.json`,
      `${root}mathfan-user-data.json`,
      `${root}csv/students.csv`,
      `${root}csv/math-answer-events.csv`,
      `${root}csv/goal-evaluations.csv`,
    ]));
    const manifest = JSON.parse(await zip.file(`${root}manifest.json`)!.async('string'));
    expect(manifest.rowCounts.students).toBe(2);
    expect(manifest.files).toHaveLength(12);
    const fullJson = JSON.parse(await zip.file(`${root}mathfan-user-data.json`)!.async('string'));
    expect(fullJson.snapshot.students[1].displayName).toBe('Sam, Jr.');
    expect(await zip.file(`${root}csv/item-states.csv`)!.async('string')).toBe('');
  });

  it('creates UTF-8 pretty JSON artifacts', async () => {
    const data = snapshot();
    const payload = buildExportPayload(data, buildExportMetadata(data, 'json'));
    const artifact = createJsonArtifact(payload, 'data.json');
    expect(artifact.blob.type).toBe('application/json');
    expect(await artifact.blob.text()).toBe(serializePrettyJson(payload));
  });
});

describe('user data export delivery', () => {
  const createObjectURL = vi.fn(() => 'blob:export');
  const revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false })) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads through a temporary anchor and always cleans up', async () => {
    const delivery = await deliverExportFile({ blob: new Blob(['ok']), filename: 'data.json' });
    expect(delivery).toBe('download');
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download="data.json"]')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });

  it('uses file sharing in standalone mode when supported', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) });
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    expect(await deliverExportFile({ blob: new Blob(['ok']), filename: 'data.json' })).toBe('share');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('falls back to download after a non-cancellation share failure', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn(async () => { throw new Error('share failed'); }) });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await deliverExportFile({ blob: new Blob(['ok']), filename: 'data.json' })).toBe('download');
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('returns readable snapshot and delivery failures without contacting Drive', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    buildSnapshotMock.mockRejectedValueOnce(new Error('db failed'));
    expect(await exportUserData('json')).toMatchObject({
      ok: false,
      error: 'Could not read the data stored on this device. Please try again.',
    });

    buildSnapshotMock.mockResolvedValueOnce(snapshot());
    createObjectURL.mockImplementationOnce(() => { throw new Error('blocked'); });
    expect(await exportUserData('json')).toMatchObject({
      ok: false,
      error: 'Could not save the export file. Please check your browser permissions and try again.',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
