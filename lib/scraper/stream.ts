import { getEpisode } from './episodes';
import type { MirrorServer } from './types';

export interface ResolvedStreamInfo {
  servers: MirrorServer[];
  primaryServer: MirrorServer | null;
  playableServers: MirrorServer[];
}

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

  // Prefer direct HLS/MP4 video when available, otherwise first available iframe mirror
  const directPreferred = playableServers.find(
    (s) => s.type === 'hls' || s.type === 'video'
  );

  return {
    servers,
    primaryServer: directPreferred || playableServers[0] || null,
    playableServers,
  };
}

export async function getEpisodeStream(slugOrUrl: string): Promise<ResolvedStreamInfo> {
  const episode = await getEpisode(slugOrUrl);
  return selectPlayableServers(episode.servers, episode.defaultEmbed);
}
