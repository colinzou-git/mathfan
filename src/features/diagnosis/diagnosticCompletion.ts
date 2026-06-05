import { pushLocal } from '../sync/driveSync';

export async function syncDiagnosticCompletionIfSignedIn(
  signedIn: boolean,
  sync: () => Promise<unknown> = pushLocal,
): Promise<void> {
  if (signedIn) await sync();
}
