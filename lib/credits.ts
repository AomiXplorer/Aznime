export interface CreditEntry {
  name: string;
  channelUrl: string;
  channelLabel: string;
}

/**
 * Kredit pengelola Aznime beserta saluran WhatsApp resmi masing-masing.
 * Dipakai oleh menu hamburger dan footer.
 */
export const CREDITS: CreditEntry[] = [
  {
    name: 'Aomi',
    channelUrl: 'https://whatsapp.com/channel/0029Vb8AgskLY6dCvnTjxU3c',
    channelLabel: 'Saluran WhatsApp Aomi',
  },
  {
    name: 'Azura',
    channelUrl: 'https://whatsapp.com/channel/0029Vb8E7w7KrWR25KfJ6o41',
    channelLabel: 'Saluran WhatsApp Azura',
  },
];
