import type { AppSnapshot } from './snapshot';
import { buildSnapshot, mergeSnapshot, validateSnapshot } from './snapshot';
import { getToken } from '../auth/googleAuth';

const FILE_NAME = 'mathfan-data.json';
const LIST_URL = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,size,modifiedTime)&q=name='${FILE_NAME}'`;
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncResult {
  ok: boolean;
  error?: string;
  syncedAt?: string;
}

interface DriveListFile {
  id: string;
  size?: string;
  modifiedTime?: string;
}

function newestSyncFile(files: DriveListFile[] | undefined): DriveListFile | null {
  if (!files?.length) return null;
  return [...files].sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))[0];
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in');
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

async function findSyncFile(): Promise<string | null> {
  const res = await authFetch(LIST_URL);
  if (!res.ok) throw new Error(`Drive LIST failed: ${res.status}`);
  const data = await res.json();
  return newestSyncFile(data.files as DriveListFile[] | undefined)?.id ?? null;
}

async function uploadSnapshot(snapshot: AppSnapshot, existingId?: string): Promise<void> {
  const body = JSON.stringify(snapshot);

  if (existingId) {
    // Update existing file (media-only PATCH)
    const res = await authFetch(
      `${UPLOAD_URL}/${existingId}?uploadType=media`,
      { method: 'PATCH', body, headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) throw new Error(`Drive PATCH failed: ${res.status}`);
  } else {
    // Create new file in appDataFolder (multipart POST)
    const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
    const boundary = 'mathfan_boundary';
    const multipart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      body,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await authFetch(
      `${UPLOAD_URL}?uploadType=multipart`,
      {
        method: 'POST',
        body: multipart,
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      }
    );
    if (!res.ok) throw new Error(`Drive POST failed: ${res.status}`);
  }
}

async function downloadSnapshot(): Promise<AppSnapshot | null> {
  const fileId = await findSyncFile();
  if (!fileId) return null;
  const res = await authFetch(`${FILES_URL}/${fileId}?alt=media`);
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const raw = await res.json();
  if (!validateSnapshot(raw)) throw new Error('Drive snapshot is invalid');
  return raw;
}

// ── Public ────────────────────────────────────────────────────────────────────

/**
 * Pull remote snapshot and merge into local DB.
 * Called after sign-in and on app startup when already signed in.
 */
export async function pullAndMerge(): Promise<SyncResult> {
  try {
    const remote = await downloadSnapshot();
    if (remote) await mergeSnapshot(remote);
    return { ok: true, syncedAt: new Date().toISOString() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Build local snapshot and push to Drive.
 * Called after each session completes.
 */
export async function pushLocal(): Promise<SyncResult> {
  try {
    const [snapshot, existingId] = await Promise.all([
      buildSnapshot(),
      findSyncFile(),
    ]);
    await uploadSnapshot(snapshot, existingId ?? undefined);
    return { ok: true, syncedAt: new Date().toISOString() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Full two-way sync: pull first (so we have the latest), then push local.
 */
export async function syncBothWays(): Promise<SyncResult> {
  try {
    const pullResult = await pullAndMerge();
    if (!pullResult.ok) throw new Error(pullResult.error);
    return await pushLocal();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export interface DriveFileInfo {
  sizeBytes: number | null;
  modifiedAt: string | null;
}

/** Get metadata of the sync file on Drive (size, last modified). */
export async function getDriveFileInfo(): Promise<DriveFileInfo> {
  try {
    const res = await authFetch(LIST_URL);
    if (!res.ok) return { sizeBytes: null, modifiedAt: null };
    const data = await res.json();
    const file = newestSyncFile(data.files as DriveListFile[] | undefined);
    if (!file) return { sizeBytes: null, modifiedAt: null };
    return {
      sizeBytes: file.size ? parseInt(file.size) : null,
      modifiedAt: file.modifiedTime ?? null,
    };
  } catch {
    return { sizeBytes: null, modifiedAt: null };
  }
}
