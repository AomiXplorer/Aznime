import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Fragment } from 'react';
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
      <ArrowUpRight size={16} aria-hidden="true" />
      <span className="sr-only"> (dibuka di tab baru)</span>
    </a>
  );
}

function Profile({ person, initial }: { person: Contributor; initial: boolean }) {
  const { id, avatar, name, role, status, active, note, socials, whatsapp } = person;

  return (
    <article id={`profile-${id}`} className={styles.profile} aria-labelledby={`name-${id}`}>
      <div className={styles.portraitFrame}>
        {avatar.kind === 'image' && (
          <Image
            src={avatar.src}
            alt={`Foto profil ${name}`}
            width={512}
            height={512}
            unoptimized
            loading={initial ? 'eager' : 'lazy'}
            className={styles.portrait}
          />
        )}
      </div>
      <div className={styles.bio}>
        <p className={styles.role}>{role}</p>
        <h3 id={`name-${id}`}>{name}</h3>
        <p className={styles.status}>
          <span data-active={active} aria-hidden="true" />
          <span className="sr-only">Status </span>{status}
        </p>
        <p className={styles.note}>{note}</p>
        <div className={styles.contacts}>
          {whatsapp && <ExternalLink href={whatsapp.url}>{whatsapp.label}</ExternalLink>}
          {(Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).map((platform) => {
            const url = socials?.[platform];
            return url ? <ExternalLink key={platform} href={url}>{SOCIAL_LABELS[platform]}</ExternalLink> : null;
          })}
        </div>
      </div>
    </article>
  );
}

export default function CreditPage() {
  return (
    <div className={styles.page}>
      <div className={styles.studio}>
        <div className={styles.shell}>
          <div className={styles.topline}>
            <Link href="/" className={styles.navLink}>
              <ArrowLeft size={17} aria-hidden="true" /> Beranda
            </Link>
            <a href="#credit-promotors" className={styles.navLink}>
              Promotor <ArrowDown size={17} aria-hidden="true" />
            </a>
          </div>
          <header className={styles.intro}>
            <div>
              <p className={styles.kicker}>Credits Aznime</p>
              <h1>Di balik layar.</h1>
            </div>
            <p>Kenali orang-orang yang merawat katalog, membangun pemutar, dan ikut memperkenalkan Aznime.</p>
          </header>

          <section className={styles.team} aria-labelledby="credit-team">
            <h2 id="credit-team">Tim Aznime</h2>
            <fieldset className={styles.showcase}>
              <legend className="sr-only">Pilih profil tim Aznime</legend>
              <div className={styles.stage}>
                {CONTRIBUTORS.map((person, index) => (
                  <Fragment key={person.id}>
                    <input
                      className={`sr-only ${styles.selector}`}
                      id={`select-${person.id}`}
                      name="credit-contributor"
                      type="radio"
                      value={person.id}
                      defaultChecked={index === 0}
                      aria-controls={`profile-${person.id}`}
                    />
                    <label htmlFor={`select-${person.id}`} className={styles.person}>
                      {person.avatar.kind === 'image' && (
                        <Image src={person.avatar.src} alt="" width={48} height={48} unoptimized className={styles.thumbnail} />
                      )}
                      <span>{person.name}</span>
                    </label>
                    <Profile person={person} initial={index === 0} />
                  </Fragment>
                ))}
              </div>
            </fieldset>
          </section>
        </div>
      </div>

      <section className={styles.community} aria-labelledby="credit-promotors">
        <div className={`${styles.shell} ${styles.communityLayout}`}>
          <div className={styles.communityIntro}>
            <h2 id="credit-promotors">Promotor</h2>
            <p>Kreator dan kanal komunitas yang ikut memperkenalkan Aznime.</p>
          </div>
          <ul className={styles.promotors}>
            {PROMOTORS.map((person) => (
              <li key={person.id} className={styles.promotor}>
                <Image
                  src={person.avatar}
                  alt={`Foto profil ${person.name}`}
                  width={96}
                  height={96}
                  unoptimized
                  className={styles.communityPortrait}
                />
                <div className={styles.promotorCopy}>
                  <h3>{person.name}</h3>
                  <p className={styles.handle}>{person.handle}</p>
                  <p className={styles.promotorBio}>{person.bio}</p>
                  <ExternalLink href={person.url}>
                    {person.buttonLabel}<span className="sr-only"> · {person.handle}</span>
                  </ExternalLink>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="credit-closing">
        <div className={styles.closingInner}>
          <h2 id="credit-closing">Sampai jumpa di episode berikutnya.</h2>
          <p>Terima kasih sudah menonton bersama Aznime.</p>
          {PRIMARY_WHATSAPP_URL && <ExternalLink href={PRIMARY_WHATSAPP_URL}>Laporkan episode rusak</ExternalLink>}
        </div>
      </section>
    </div>
  );
}
