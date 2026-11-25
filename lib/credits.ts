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
 * Azura sengaja tanpa `whatsapp`: kanal resminya belum ada, jadi tombolnya
 * tidak dirender sama sekali alih-alih memakai tautan pinjaman atau tautan mati.
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
      label: 'Connect with Aomi',
    },
  },
  {
    id: 'azura',
    name: 'Azura',
    role: 'Contributor',
    status: 'Contributor',
    active: false,
    avatar: { kind: 'anonymous' },
    note: 'Ikut mengurus tampilan dan pengecekan judul. Kanal WhatsApp belum tersedia.',
    whatsapp: null,
  },
  {
    id: 'dani',
    name: 'Watashi',
    role: 'Back-End',
    status: 'Contributor',
    active: false,
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
    status: 'Contributor',
    active: false,
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
