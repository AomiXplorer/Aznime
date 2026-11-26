import type { MaintenanceState } from '../maintenance';
import { PersistenceError } from './config';
import { database } from './supabase';

export function maintenanceRow(state: MaintenanceState) {
  return { singleton: true, enabled: state.enabled, message: state.message,
    started_at: state.startedAt, ends_at: state.endsAt, updated_by: state.updatedBy, updated_at: state.updatedAt };
}

export async function pgMaintenance(): Promise<MaintenanceState | null> {
  const { data, error } = await database().from('aznime_maintenance')
    .select('enabled,message,started_at,ends_at,updated_by,updated_at').eq('singleton', true).maybeSingle();
  if (error) throw new PersistenceError();
  if (!data) return null;
  return { enabled: data.enabled, message: data.message,
    startedAt: data.started_at && new Date(data.started_at).toISOString(),
    endsAt: data.ends_at && new Date(data.ends_at).toISOString(), updatedBy: data.updated_by,
    updatedAt: data.updated_at && new Date(data.updated_at).toISOString() };
}

export async function pgSetMaintenance(state: MaintenanceState): Promise<void> {
  const { error } = await database().from('aznime_maintenance').upsert(maintenanceRow(state), { onConflict: 'singleton' });
  if (error) throw new PersistenceError();
}
