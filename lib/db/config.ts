export class PersistenceError extends Error {
  constructor() {
    super('Persistent storage unavailable');
    this.name = 'PersistenceError';
  }
}

export function usesPostgres(): boolean {
  const mode = process.env.AZNIME_PERSISTENCE?.trim();
  if (!mode || mode === 'redis') return false;
  if (mode === 'postgres') return true;
  throw new PersistenceError();
}

export function usesPostgresHistory(): boolean {
  if (usesPostgres()) return true;
  const mode = process.env.AZNIME_HISTORY_PERSISTENCE?.trim();
  if (!mode || mode === 'redis') return false;
  if (mode === 'postgres') return true;
  throw new PersistenceError();
}
