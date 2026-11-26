import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDownRight, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { CONTRIBUTORS, PRIMARY_WHATSAPP_URL, PROMOTORS, type Contributor } from '@/lib/credits';
import { socialMeta } from '@/lib/seo';
import styles from './credit.module.css';

const description = 'Kenali tim pengembang, kontributor, dan promoter yang ikut merawat Aznime.';

export const metadata: Metadata = {
  ...socialMeta('Credits', description),
  title: 'Credits',
  description,
  alternates: { canonical: '/credit' },
};

const SOCIAL_LABELS = {
  github: 'GitHub',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
} as const;

const SECTIONS = [
  { id: 'credit-developers', label: 'Developer' },
  { id: 'credit-contributors', label: 'Contributor' },
  { id: 'credit-promotors', label: 'Promoter' },
];

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={styles.textLink} target="_blank" rel="noopener noreferrer">
      <span>{children}</span>
      <ArrowUpRight size={16} aria-hidden="true" />
      <span className="sr-only"> (dibuka di tab baru)</span>
    </a>
  );
}

function Portrait({ person, eager = false }: { person: Contributor; eager?: boolean }) {
  if (person.avatar.kind !== 'image') return null;

  return (
    <Image
      src={person.avatar.src}
      alt={`Foto profil ${person.name}`}
      width={512}
      height={512}
      unoptimized
      loading={eager ? 'eager' : 'lazy'}
      className={styles.portrait}
    />
  );
}

function ContributorDetails({ person }: { person: Contributor }) {
  const { id, name, role, status, active, note, socials, whatsapp } = person;

  return (
    <div className={styles.details}>
      <div className={styles.profileMeta}>
        <p>{role}</p>
        <p className={styles.status}>
          <span data-active={active} aria-hidden="true" />
          <span className="sr-only">Status {status}</span>
          <span aria-hidden="true">{'>///<'}</span>
        </p>
      </div>
      <h3 id={`name-${id}`}>{name}</h3>
      <p className={styles.bio}>{note}</p>
      {(whatsapp || socials) && (
        <div className={styles.contacts}>
          {whatsapp && <ExternalLink href={whatsapp.url}>{whatsapp.label}</ExternalLink>}
          {(Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).map((platform) => {
            const url = socials?.[platform];
            return url ? <ExternalLink key={platform} href={url}>{SOCIAL_LABELS[platform]}</ExternalLink> : null;
          })}
        </div>
      )}
    </div>
  );
}

export default function CreditPage() {
  const developers = CONTRIBUTORS.filter((person) => person.role !== 'Contributor');
  const [featuredDeveloper, ...engineering] = developers;
  const lead: Contributor | undefined = featuredDeveloper?.id === 'aomi'
    ? {
        ...featuredDeveloper,
        avatar: { kind: 'image', src: '/contributors/aomi-credit.gif' },
        note: 'Merancang, mengembangkan, dan mengelola infrastruktur web Aznime, mulai dari frontend, backend, database, hingga integrasi layanan dan optimasi sistem',
      }
    : featuredDeveloper;
  const contributors = CONTRIBUTORS.filter((person) => person.role === 'Contributor');

  return (
    <div className={styles.page}>
      <header className={`${styles.shell} ${styles.masthead}`}>
        <div>
          <h1>Kredit Aznime</h1>
          <p className={styles.intro}>Orang-orang yang membangun, merawat, dan memperkenalkan Aznime.</p>
        </div>
        <nav aria-label="Bagian halaman Credits" className={styles.index}>
          {SECTIONS.map(({ id, label }) => (
            <a key={id} href={`#${id}`} className={styles.indexLink}>
              {label}<ArrowDownRight size={17} aria-hidden="true" />
            </a>
          ))}
        </nav>
      </header>

      <section className={`${styles.shell} ${styles.developers}`} aria-labelledby="credit-developers">
        <h2 id="credit-developers" className={styles.sectionHeading}>Developer</h2>
        {lead && (
          <article className={styles.feature} aria-labelledby={`name-${lead.id}`}>
            <div className={styles.featureImage}>
              <Portrait person={lead} eager />
            </div>
            <ContributorDetails person={lead} />
          </article>
        )}
        <div className={styles.engineering}>
          {engineering.map((person) => (
            <article key={person.id} className={styles.engineer} aria-labelledby={`name-${person.id}`}>
              <Portrait person={person} />
              <ContributorDetails person={person} />
            </article>
          ))}
        </div>
      </section>

      <section className={styles.contributorBand} aria-labelledby="credit-contributors">
        <div className={`${styles.shell} ${styles.contributors}`}>
          <h2 id="credit-contributors" className={styles.sectionHeading}>Contributor</h2>
          {contributors.map((person) => (
            <article key={person.id} className={styles.contributor} aria-labelledby={`name-${person.id}`}>
              <ContributorDetails person={person} />
              <Portrait person={person} />
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.shell} ${styles.partners}`} aria-labelledby="credit-promotors">
        <div className={styles.partnerIntro}>
          <h2 id="credit-promotors" className={styles.sectionHeading}>Promoter</h2>
          <p>Kreator dan kanal komunitas yang ikut memperkenalkan Aznime.</p>
        </div>
        <ul className={styles.partnerList}>
          {PROMOTORS.map((person) => (
            <li key={person.id} className={styles.partner}>
              <Image
                src={person.avatar}
                alt={`Foto profil ${person.name}`}
                width={160}
                height={160}
                unoptimized
                className={styles.portrait}
              />
              <div className={styles.partnerDetails}>
                <h3>{person.name}</h3>
                <p className={styles.handle}>{person.handle}</p>
                <p className={styles.bio}>{person.bio}</p>
              </div>
              <div className={styles.partnerLink}>
                <ExternalLink href={person.url}>
                  {person.buttonLabel}<span className="sr-only"> · {person.handle}</span>
                </ExternalLink>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.shell} ${styles.closing}`} aria-labelledby="credit-closing">
        <h2 id="credit-closing">Terima kasih sudah menonton.</h2>
        <div className={styles.closingLinks}>
          <Link href="/" className={styles.textLink}>
            <ArrowLeft size={16} aria-hidden="true" /><span>Kembali ke beranda</span>
          </Link>
          {PRIMARY_WHATSAPP_URL && <ExternalLink href={PRIMARY_WHATSAPP_URL}>Laporkan episode rusak</ExternalLink>}
        </div>
      </section>
    </div>
  );
}
