import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSnapshot } from '../features/sync/snapshot';

const { buildSnapshotMock } = vi.hoisted(() => ({ buildSnapshotMock: vi.fn() }));

vi.mock('../features/sync/snapshot', () => ({ buildSnapshot: buildSnapshotMock }));

import {
  OBJECT_URL_REVOKE_DELAY_MS,
  buildExportMetadata,
  buildExportPayload,
  canShareExportArtifact,
  classifyShareError,
  createJsonArtifact,
  createZipArtifact,
  downloadBlobArtifact,
  downloadPreparedExport,
  exportUserData,
  formatExportFilename,
  getSnapshotTables,
  prepareUserDataExport,
  serializeCsv,
  serializePrettyJson,
  sharePreparedExport,
  type PreparedUserDataExport,
} from '../features/export/userDataExport';

function snapshot(): AppSnapshot {
  return {
    appId: 'mathfan',
    snapshotVersion: 2,
    snapshotAt: '2026-07-13T12:00:00.000Z',
    students: [
      {
        id: 'student-1', displayName: 'Alex Raw Name', gradeLevel: 3, timezone: 'UTC', createdAt: '2026-01-01T00:00:00.000Z',
        settings: {
          audioEnabled: true, speechRate: 1, dailyGoalMinutes: 10, sessionLength: 10, autoAdvance: true,
          theme: 'indigo', allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false,
        },
      },
      {
        id: 'student-2', displayName: 'Sam, Jr.', gradeLevel: 4, timezone: 'UTC', createdAt: '2026-02-01T00:00:00.000Z',
        settings: {
          audioEnabled: false, speechRate: 1, dailyGoalMinutes: 10, sessionLength: 10, autoAdvance: false,
          theme: 'indigo', allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false,
        },
      },
    ],
    itemStates: [], attempts: [], sessions: [], multFactStats: [], quizSessions: [], mathAnswerEvents: [],
    learningGoals: [], goalEvents: [], goalEvaluations: [],
  };
}

function prepared(format: 'json' | 'zip' = 'json'): PreparedUserDataExport {
  const filename = `data.${format}`;
  const blob = new Blob(['ok'], { type: format === 'json' ? 'application/json' : 'application/zip' });
  return { filename, format, blob, file: new File([blob], filename, { type: blob.type }) };
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
      exportSchemaVersion: 1, exportedAt: exportedAt.toISOString(), exportMode: 'local', profileScope: 'all',
      privacyMode: 'raw', source: 'indexeddb', format: 'json', appVersion: 'test', gitSha: 'testsha',
      buildTime: '2026-01-01T00:00:00.000Z', snapshotVersion: 2,
    });
    expect(metadata.tableCounts.students).toBe(2);
    expect(metadata.modelVersions).toMatchObject({ cardModel: 'semantic-word-cards-v2', fsrsConfig: expect.any(String) });
    expect(serializePrettyJson(payload)).toMatch(/\n$/);
  });

  it('formats deterministic local timestamps without Windows-unsafe characters', () => {
    const date = new Date(2026, 6, 13, 9, 8, 7);
    expect(formatExportFilename(date, 'json')).toBe('mathfan-user-data-20260713-090807.json');
    expect(formatExportFilename(date, 'zip')).not.toMatch(/[:\\/]/);
  });

  it('serializes deterministic RFC-4180-style CSV values', () => {
    expect(serializeCsv([
      { z: null, a: 'comma,value', bool: true, number: 4, nested: { x: 'y' }, lines: 'a\r\nb', quote: 'say "hi"' },
    ])).toBe(
      'a,bool,lines,nested,number,quote,z\r\n' +
      '"comma,value",true,"a\r\nb","{""x"":""y""}",4,"say ""hi""",\r\n',
    );
    expect(serializeCsv([])).toBe('');
  });

  it('creates a ZIP with manifest, complete JSON, and every CSV table', async () => {
    const data = snapshot();
    const metadata = buildExportMetadata(data, 'zip', new Date('2026-07-13T12:34:56.000Z'));
    const artifact = await createZipArtifact(buildExportPayload(data, metadata), 'mathfan-user-data-20260713-123456.zip');
    const zip = await JSZip.loadAsync(await artifact.blob.arrayBuffer());
    const root = 'mathfan-user-data-20260713-123456/';

    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
      `${root}manifest.json`, `${root}mathfan-user-data.json`, `${root}csv/students.csv`,
      `${root}csv/math-answer-events.csv`, `${root}csv/goal-evaluations.csv`,
    ]));
    const manifest = JSON.parse(await zip.file(`${root}manifest.json`)!.async('string'));
    expect(manifest.rowCounts.students).toBe(2);
    expect(manifest.files).toHaveLength(13);
    expect(manifest.files).toContain('csv/scheduling-telemetry.csv');
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

describe('user data export preparation and sharing', () => {
  const createObjectURL = vi.fn(() => 'blob:export');
  const revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    buildSnapshotMock.mockResolvedValue(snapshot());
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false })) });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });

  afterEach(() => {
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
    vi.unstubAllGlobals();
  });

  it('prepares JSON and ZIP artifacts without sharing or downloading', async () => {
    const json = await prepareUserDataExport('json');
    const zip = await prepareUserDataExport('zip');
    expect(json).toMatchObject({ ok: true, artifact: { format: 'json', blob: expect.any(Blob), file: expect.any(File) } });
    expect(zip).toMatchObject({ ok: true, artifact: { format: 'zip', blob: expect.any(Blob), file: expect.any(File) } });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(navigator.share).toBeUndefined();
  });

  it('reports stage-specific preparation failures without network access', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    buildSnapshotMock.mockRejectedValueOnce(new Error('db failed'));
    expect(await prepareUserDataExport('json')).toMatchObject({
      ok: false, error: 'Could not read the data stored on this device. Please try again.',
    });

    const cyclic = snapshot() as AppSnapshot & { cycle?: unknown };
    cyclic.cycle = cyclic;
    buildSnapshotMock.mockResolvedValueOnce(cyclic);
    expect(await prepareUserDataExport('json')).toMatchObject({
      ok: false, error: 'Could not create the JSON export. Please try again.',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires standalone mode and complete Web Share file support', () => {
    expect(canShareExportArtifact(prepared())).toBe(false);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    expect(canShareExportArtifact(prepared())).toBe(true);
    expect(canShareExportArtifact({ ...prepared(), file: null })).toBe(false);
  });

  it('shares an already prepared file and returns explicit unavailable semantics', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    const artifact = prepared();
    expect(await sharePreparedExport(artifact)).toEqual({ status: 'shared' });
    expect(share).toHaveBeenCalledWith({ files: [artifact.file], title: 'MathFan user data export' });

    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => false) });
    share.mockClear();
    expect(await sharePreparedExport(artifact)).toMatchObject({ status: 'unavailable' });
    expect(share).not.toHaveBeenCalled();
  });

  it('classifies dismissals and failures without automatic download fallback', async () => {
    expect(classifyShareError(new DOMException('closed', 'AbortError'))).toEqual({ status: 'dismissed' });
    expect(classifyShareError(new DOMException('blocked', 'NotAllowedError'))).toMatchObject({
      status: 'failed', message: expect.stringMatching(/blocked/i),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(classifyShareError(new Error('failed'))).toMatchObject({ status: 'failed' });
    expect(errorSpy).toHaveBeenCalledWith('[MathFan export] Web Share failed.', expect.any(Error));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('returns dismissed from share without logging or downloading', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn(async () => { throw new DOMException('closed', 'AbortError'); }),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await sharePreparedExport(prepared())).toEqual({ status: 'dismissed' });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('removes anchors immediately and revokes successful URLs only after the delay', () => {
    vi.useFakeTimers();
    expect(downloadBlobArtifact(prepared())).toBe('download');
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download="data.json"]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(OBJECT_URL_REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:export');
  });

  it('cleans up immediately on click failure and returns a readable delivery error', () => {
    click.mockImplementationOnce(() => { throw new Error('click blocked'); });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = downloadPreparedExport(prepared());
    expect(result).toMatchObject({
      ok: false,
      error: 'Could not save the export file. Please check your browser permissions and try again.',
    });
    expect(document.querySelector('a[download="data.json"]')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:export');
  });

  it('eventually revokes every URL from repeated downloads exactly once', () => {
    vi.useFakeTimers();
    createObjectURL.mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two').mockReturnValueOnce('blob:three');
    downloadBlobArtifact(prepared());
    downloadBlobArtifact(prepared());
    downloadBlobArtifact(prepared());
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(OBJECT_URL_REVOKE_DELAY_MS);
    expect(revokeObjectURL.mock.calls.map(call => call[0])).toEqual(['blob:one', 'blob:two', 'blob:three']);
  });

  it('keeps the convenience export API as a normal download path', async () => {
    vi.useFakeTimers();
    expect(await exportUserData('json')).toMatchObject({ ok: true, format: 'json', delivery: 'download' });
    expect(createObjectURL).toHaveBeenCalledOnce();
  });
});
