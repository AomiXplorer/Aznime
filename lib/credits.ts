export type ContributorAvatar =
  | { kind: 'image'; src: string }
  | { kind: 'anonymous' };

export interface ContributorChannel {
  url: string;
  label: string;
}

/**
 * Link sosial opsional. Field yang tidak diisi tidak dirender sama sekali.
 */
export interface ContributorSocials {
  github?: string;
  instagram?: string;
  linkedin?: string;
  telegram?: string;
}

export interface Contributor {
  id: string;
  name: string;
  role: string;
  status: string;
  active: boolean;
  avatar: ContributorAvatar;
  note: string;
  whatsapp: ContributorChannel | null;
  socials?: ContributorSocials;
}

/**
 * Sumber tunggal data contributor. Dipakai halaman Credit, layar Maintenance,
 * dan tautan laporan di player supaya tidak ada salinan data yang menyimpang.
 */
export const CONTRIBUTORS: Contributor[] = [
  {
    id: 'aomi',
    name: 'Aomi',
    role: 'Developer',
    status: 'Active',
    active: true,
    avatar: { kind: 'image', src: '/contributors/aomi.jpg' },
    note: 'Merawat katalog dan server. Kanal WhatsApp resmi untuk kabar rilis dan laporan episode rusak.',
    whatsapp: {
      url: 'https://whatsapp.com/channel/0029Vb8AgskLY6dCvnTjxU3c',
      label: 'With Aomi',
    },
  },
  {
    id: 'azura',
    name: 'Azura',
    role: 'Contributor',
    status: 'Active',
    active: true,
    avatar: { kind: 'image', src: '/contributors/azura.jpg' },
    note: 'Ikut mengurus tampilan dan pengecekan judul.',
    whatsapp: {
      url: 'https://whatsapp.com/channel/0029Vb8E7w7KrWR25KfJ6o41',
      label: 'With Azura',
    },
  },
  {
    id: 'dani',
    name: 'Watashi',
    role: 'Back-End',
    status: 'Active',
    active: true,
    avatar: { kind: 'image', src: '/contributors/watashi.jpg' },
    note: 'Ikut serta dalam pengembangan arsitektur sistem.',
    whatsapp: null,
    socials: {
      github: 'https://github.com/DanX-007',
      instagram: 'https://instagram.com/dansetiawn',
    },
  },
  {
    id: 'hapid',
    name: 'Yuui',
    role: 'Back-End & Front-End',
    status: 'Active',
    active: true,
    avatar: { kind: 'image', src: '/contributors/yui.jpg' },
    note: 'Mengurus jalur scraper episode, pemutar video, sistem akun, serta pengecekan bug dan perbaikan fitur.',
    whatsapp: null,
    socials: {
      github: 'https://github.com/Yuuuii-ch',
    },
  },
];

export const PRIMARY_WHATSAPP_URL =
  CONTRIBUTORS.find((contributor) => contributor.whatsapp)?.whatsapp?.url ?? null;

export interface Promotor {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  platform: 'tiktok' | 'whatsapp';
  url: string;
  buttonLabel: string;
}

export const PROMOTORS: Promotor[] = [
  {
    id: 'valkcarol',
    name: 'ValkCarol',
    handle: '@valkcarol_',
    avatar: '/contributors/valkcarol.jpg',
    bio: 'hanya Content Creator Kecil yaa~ Pangil aj Pinaa ♡',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@valkcarol_',
    buttonLabel: 'TikTok',
  },
  {
    id: 'hibiskuy',
    name: 'Hibiskuy',
    handle: '@hibikii2',
    avatar: '/contributors/hibiskuy.jpg',
    bio: 'just here for fun',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@hibikii2?_r=1&_t=ZS-9BjBgmGxtno',
    buttonLabel: 'TikTok',
  },
  {
    id: 'azura-promotor',
    name: 'Azura',
    handle: '@azura',
    avatar: '/contributors/azura.jpg',
    bio: 'Kanal komunitas & partner promosi Aznime.',
    platform: 'whatsapp',
    url: 'https://whatsapp.com/channel/0029Vb8E7w7KrWR25KfJ6o41',
    buttonLabel: 'With Azura',
  },
];
