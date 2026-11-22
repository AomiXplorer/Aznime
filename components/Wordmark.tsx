import { cn } from '@/lib/cn';

/**
 * Logotype Aznime: "Az" putih, "nime" merah, memakai wajah display yang sama
 * dengan judul. Dua warna solid tanpa gradien, bayangan, atau outline, jadi
 * tetap tajam di latar gelap dan tidak pecah saat diperkecil di layar HP.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block font-display font-bold leading-none tracking-[-0.045em]',
        className
      )}
    >
      {/* Kedua span sengaja menempel tanpa spasi JSX supaya tidak terbaca
          sebagai dua kata. */}
      <span className="text-white">Az</span><span className="text-accent">nime</span>
    </span>
  );
}
