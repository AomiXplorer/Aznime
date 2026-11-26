import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { CONTRIBUTORS, PRIMARY_WHATSAPP_URL, PROMOTORS, type Contributor } from '@/lib/credits';
import { socialMeta } from '@/lib/seo';
import styles from './credit.module.css';

const description = 'Kenali tim pengembang, kontributor, dan promotor yang ikut merawat Aznime.';

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

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={styles.external} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
      <span className="sr-only"> (dibuka di tab baru)</span>
    </a>
  );
}

function Profile({ person, lead = false }: { person: Contributor; lead?: boolean }) {
  const { avatar, name, role, status, active, note, socials, whatsapp } = person;

  return (
    <article className={lead ? styles.lead : styles.profile} aria-labelledby={`credit-${person.id}`}>
      {avatar.kind === 'image' ? (
        <Image
          src={avatar.src}
          alt={`Foto profil ${name}`}
          width={lead ? 512 : 240}
          height={lead ? 512 : 240}
          unoptimized
          loading={lead ? 'eager' : 'lazy'}
          className={styles.portrait}
        />
      ) : null}
      <div className={styles.profileHeading}>
        <p className={styles.role}>{role}</p>
        <h3 id={`credit-${person.id}`}>{name}</h3>
        <p className={styles.status}>
          <span className={active ? styles.activeDot : styles.inactiveDot} aria-hidden="true" />
          <span className="sr-only">Status </span>{status}
        </p>
      </div>
      <div className={styles.profileDetails}>
        <p>{note}</p>
        {whatsapp || socials ? (
          <div className={styles.contacts}>
            {whatsapp ? <ExternalLink href={whatsapp.url}>{whatsapp.label}</ExternalLink> : null}
            {(Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).map((platform) => {
              const url = socials?.[platform];
              return url ? <ExternalLink key={platform} href={url}>{SOCIAL_LABELS[platform]}</ExternalLink> : null;
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function CreditPage() {
  const [lead, ...team] = CONTRIBUTORS;

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.shell}>
          <Link href="/" className={styles.back}>
            <ArrowLeft size={16} aria-hidden="true" /> Kembali ke beranda
          </Link>
          <div className={styles.mastheadGrid}>
            <div>
              <p className={styles.kicker}>Credits</p>
              <h1>Orang-orang di balik Aznime</h1>
              <p className={styles.intro}>Tim yang merawat katalog, server, dan tampilan, serta kreator yang ikut memperkenalkan Aznime.</p>
            </div>
            <nav className={styles.index} aria-label="Bagian halaman Credits">
              <a href="#credit-contributors">Tim Aznime <ArrowDown size={17} aria-hidden="true" /></a>
              <a href="#credit-promotors">Promotor <ArrowDown size={17} aria-hidden="true" /></a>
            </nav>
          </div>
        </div>
      </header>

      <section className={`${styles.shell} ${styles.team}`} aria-labelledby="credit-contributors">
        <h2 id="credit-contributors">Tim Aznime</h2>
        <div className={styles.teamGrid}>
          {lead ? <Profile person={lead} lead /> : null}
          <div className={styles.roster}>
            {team.map((person) => <Profile key={person.id} person={person} />)}
          </div>
        </div>
      </section>

      <section className={styles.promotors} aria-labelledby="credit-promotors">
        <div className={`${styles.shell} ${styles.promotorLayout}`}>
          <div>
            <h2 id="credit-promotors">Promotor</h2>
            <p className={styles.promotorIntro}>Kreator dan kanal komunitas yang ikut memperkenalkan Aznime.</p>
          </div>
          <ul className={styles.directory}>
            {PROMOTORS.map((person) => (
              <li key={person.id} className={styles.directoryEntry}>
                <Image
                  src={person.avatar}
                  alt={`Foto profil ${person.name}`}
                  width={64}
                  height={64}
                  unoptimized
                  className={styles.directoryPortrait}
                />
                <div className={styles.directoryIdentity}>
                  <h3>{person.name}</h3>
                  <p>{person.handle}</p>
                </div>
                <p className={styles.bio}>{person.bio}</p>
                <div className={styles.directoryLink}>
                  <ExternalLink href={person.url}>
                    {person.buttonLabel}
                    <span className="sr-only"> · {person.handle}</span>
                  </ExternalLink>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.shell} ${styles.closing}`} aria-labelledby="credit-closing">
        <h2 id="credit-closing">Terima kasih sudah menonton.</h2>
        <div>
          <p>Ada episode rusak atau tautan mati? Kabari kami lewat kanal WhatsApp Aznime.</p>
          {PRIMARY_WHATSAPP_URL ? <ExternalLink href={PRIMARY_WHATSAPP_URL}>Laporkan masalah</ExternalLink> : null}
        </div>
      </section>
    </div>
  );
}
