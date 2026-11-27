'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface DeleteAccountDialogProps {
  open: boolean;
  username: string;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * Penghapusan akun tidak bisa dibatalkan, jadi tombolnya baru aktif setelah
 * nama pengguna diketik ulang. Satu salah klik tidak cukup untuk menghapus.
 */
export function DeleteAccountDialog({
  open,
  username,
  onClose,
  onDeleted,
}: DeleteAccountDialogProps) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue('');
    setError(null);
    setBusy(false);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const confirmed = value.trim().toLowerCase() === username.trim().toLowerCase();

  const submit = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/account', { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || 'Akun gagal dihapus. Coba lagi sebentar lagi.');
        setBusy(false);
        return;
      }
      onDeleted();
    } catch {
      setError('Tidak bisa menghubungi server. Periksa koneksimu lalu coba lagi.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Tutup dialog hapus akun"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/80"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="relative w-full max-w-md rounded-[10px] border border-white/[0.09] bg-[#131010] p-5 shadow-2xl shadow-black/70"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent-soft">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="delete-account-title" className="text-[16px] font-semibold text-white">
              Hapus akun permanen?
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
              Akun, riwayat tontonan, dan daftar favorit dihapus dari server. Setelah ini kamu
              tidak bisa masuk lagi dengan email yang sama kecuali mendaftar ulang dari nol.
            </p>
          </div>
        </div>

        <label htmlFor="delete-account-confirm" className="mt-4 block text-[12px] text-zinc-400">
          Ketik <span className="font-semibold text-zinc-200">{username}</span> untuk melanjutkan.
        </label>
        <input
          ref={inputRef}
          id="delete-account-confirm"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 h-10 w-full rounded-[4px] border border-line bg-black/40 px-3 text-[13px] text-white outline-none transition-colors focus:border-accent/60"
        />

        {error ? (
          <p role="alert" className="mt-2.5 text-[12px] leading-relaxed text-accent-soft">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={submit}
            disabled={!confirmed || busy}
            className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[4px] bg-accent-strong px-4 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Menghapus…' : 'Hapus akun'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[4px] border border-white/[0.12] px-4 text-[13px] font-semibold text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
