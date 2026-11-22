export type ContributorMotif = 'sun' | 'moon';

export interface ContributorChannel {
  url: string;
  label: string;
}

export interface Contributor {
  id: string;
  name: string;
  role: string;
  status: string;
  active: boolean;
  motif: ContributorMotif;
  note: string;
  whatsapp: ContributorChannel | null;
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
    role: 'Contributor',
    status: 'Active',
    active: true,
    motif: 'sun',
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
    motif: 'moon',
    note: 'Ikut mengurus tampilan dan pengecekan judul. Kanal WhatsApp belum tersedia.',
    whatsapp: null,
  },
];

export const PRIMARY_WHATSAPP_URL =
  CONTRIBUTORS.find((contributor) => contributor.whatsapp)?.whatsapp?.url ?? null;
