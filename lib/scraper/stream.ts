import { getEpisode } from './episodes';
import type { MirrorServer } from './types';

export interface ResolvedStreamInfo {
  servers: MirrorServer[];
  primaryServer: MirrorServer | null;
  playableServers: MirrorServer[];
}

/** Server yang dipakai lebih dulu di pemutar. */
const DEFAULT_SERVER = 'vastads';

const normalizeServerName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '');

const isDefaultServer = (server: MirrorServer) =>
  normalizeServerName(server.name).startsWith(DEFAULT_SERVER);

export function selectPlayableServers(
  servers: MirrorServer[],
  defaultEmbed: string | null
): ResolvedStreamInfo {
  const playableServers = servers.filter((s) => s.available && Boolean(s.url));

  if (playableServers.length === 0 && defaultEmbed) {
    const fallback: MirrorServer = {
      name: 'Default Server',
      available: true,
      type: /\.m3u8(\?|$)/i.test(defaultEmbed) ? 'hls' : 'iframe',
      url: defaultEmbed,
    };
    return {
      servers: [fallback, ...servers],
      primaryServer: fallback,
      playableServers: [fallback],
    };
  }

  // vastads selalu jadi pilihan pertama; kalau tidak ada, pakai video direct.
  const preferred =
    playableServers.find(isDefaultServer) ||
    playableServers.find((s) => s.type === 'hls' || s.type === 'video') ||
    playableServers[0] ||
    null;

  const orderedServers = preferred
    ? [preferred, ...servers.filter((s) => s !== preferred)]
    : servers;

  return {
    servers: orderedServers,
    primaryServer: preferred,
    playableServers,
  };
}

export async function getEpisodeStream(slugOrUrl: string): Promise<ResolvedStreamInfo> {
  const episode = await getEpisode(slugOrUrl);
  return selectPlayableServers(episode.servers, episode.defaultEmbed);
}
