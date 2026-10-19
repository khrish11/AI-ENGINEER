import { v4 as uuidv4 } from "uuid";
import { db, type LocalProfile } from "./db";

const LOCAL_PROFILE_ID = "local_profile_001";
const DEVICE_ROW_ID = "device_001";

export function generateDeviceId(): string {
  return uuidv4();
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await db.deviceMetadata.get(DEVICE_ROW_ID);
  if (existing?.deviceId) {
    return existing.deviceId;
  }

  const deviceId = generateDeviceId();
  await db.deviceMetadata.put({
    id: DEVICE_ROW_ID,
    deviceId,
    createdAt: new Date().toISOString(),
  });
  return deviceId;
}

export async function getLocalProfile(): Promise<LocalProfile | null> {
  return (await db.localProfile.get(LOCAL_PROFILE_ID)) ?? null;
}

export async function ensureLocalProfile(
  deviceId?: string,
  overrides: Partial<LocalProfile> = {}
): Promise<LocalProfile> {
  const resolvedDeviceId = deviceId ?? (await getOrCreateDeviceId());
  const existing = await getLocalProfile();
  if (existing) {
    await db.localProfile.update(LOCAL_PROFILE_ID, {
      ...overrides,
      updatedAt: new Date().toISOString(),
    });
    const updated = await getLocalProfile();
    if (!updated) throw new Error("Failed to retrieve updated profile");
    return updated;
  }

  const now = new Date().toISOString();
  const profile: LocalProfile = {
    id: LOCAL_PROFILE_ID,
    deviceId: resolvedDeviceId,
    guestId: uuidv4(),
    displayName: null,
    email: null,
    isAuthenticated: false,
    lastSyncAt: null,
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncStatus: "pending",
    ...overrides,
  };

  await db.localProfile.put(profile);
  return profile;
}

export async function markAuthenticated(
  email: string | null,
  displayName: string | null
): Promise<LocalProfile> {
  const deviceId = await getOrCreateDeviceId();
  return ensureLocalProfile(deviceId, {
    isAuthenticated: true,
    email,
    displayName,
  });
}

export async function markGuest(): Promise<LocalProfile> {
  const deviceId = await getOrCreateDeviceId();
  return ensureLocalProfile(deviceId, {
    isAuthenticated: false,
  });
}

export async function updateLastSync(): Promise<void> {
  const profile = await getLocalProfile();
  if (!profile) return;
  await db.localProfile.update(LOCAL_PROFILE_ID, {
    lastSyncAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localRevision: profile.localRevision + 1,
  });
}

export function shortenDeviceId(deviceId: string): string {
  return deviceId.slice(0, 8);
}
