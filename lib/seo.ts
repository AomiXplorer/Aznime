import {
  absoluteUrl,
  HOME_URL,
  SITE_ALTERNATE_NAME,
  SITE_DESCRIPTION,
  SITE_LANG,
  SITE_LOGO_PATH,
  SITE_NAME,
  SITE_URL,
} from './site';

/**
 * Satu sumber kebenaran untuk structured data identitas situs.
 *
 * Google memakai WebSite.name (dan og:site_name) untuk menentukan nama situs yang
 * tampil di hasil pencarian. Tanpa entitas Organization yang menaungi WebSite,
 * nama brand hanya menempel pada judul halaman dan mudah tidak dikenali. Jadi
 * keduanya dikirim dalam satu @graph yang saling merujuk lewat @id.
 */
export function organizationId(): string {
  return `${SITE_URL}/#organization`;
}

export function websiteId(): string {
  return `${SITE_URL}/#website`;
}

export function logoId(): string {
  return `${SITE_URL}/#logo`;
}

/** Organization + WebSite untuk root layout (dipakai di semua halaman). */
export function siteJsonLd(): Record<string, unknown> {
  const logoUrl = absoluteUrl(SITE_LOGO_PATH);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId(),
        name: SITE_NAME,
        url: HOME_URL,
        description: SITE_DESCRIPTION,
        logo: {
          '@type': 'ImageObject',
          '@id': logoId(),
          url: logoUrl,
          contentUrl: logoUrl,
          width: 512,
          height: 512,
          caption: SITE_NAME,
        },
        // sameAs sengaja tidak diisi: belum ada profil resmi yang bisa
        // diverifikasi. Menambahkannya nanti hanya setelah akunnya benar-benar ada.
      },
      {
        '@type': 'WebSite',
        '@id': websiteId(),
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAME,
        url: HOME_URL,
        inLanguage: SITE_LANG,
        description: SITE_DESCRIPTION,
        publisher: { '@id': organizationId() },
        // SearchAction tidak lagi dikirim: target-nya /search yang sengaja
        // dilarang di robots.txt, dan Google sudah menghentikan fitur kotak
        // pencarian sitelinks.
      },
    ],
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Path relatif, mis. `/anime/naruto`. */
  path: string;
}

/** BreadcrumbList; hanya dipakai di halaman yang memang punya breadcrumb terlihat. */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
