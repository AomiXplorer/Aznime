export interface FieldError {
  field: string;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/i;

export function normalizeEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

export function validateEmail(email: string): FieldError | null {
  if (!email) return { field: 'email', message: 'Email wajib diisi.' };
  if (email.length > 254) return { field: 'email', message: 'Email terlalu panjang.' };
  if (!EMAIL_RE.test(email)) return { field: 'email', message: 'Format email tidak valid.' };
  return null;
}

export function validatePassword(password: unknown): FieldError | null {
  if (typeof password !== 'string' || password.length === 0) {
    return { field: 'password', message: 'Password wajib diisi.' };
  }
  if (password.length < 8) return { field: 'password', message: 'Password minimal 8 karakter.' };
  if (password.length > 128) return { field: 'password', message: 'Password maksimal 128 karakter.' };
  return null;
}

export function validatePasswordConfirm(password: unknown, confirm: unknown): FieldError | null {
  if (typeof confirm !== 'string' || confirm.length === 0) {
    return { field: 'confirmPassword', message: 'Konfirmasi password wajib diisi.' };
  }
  if (password !== confirm) {
    return { field: 'confirmPassword', message: 'Konfirmasi password tidak sama.' };
  }
  return null;
}

/** Username opsional saat daftar; kalau kosong dipakai bagian depan email. */
export function validateUsername(username: string): FieldError | null {
  if (!username) return null;
  if (!USERNAME_RE.test(username)) {
    return { field: 'username', message: 'Username 3-24 karakter: huruf, angka, titik, garis bawah, atau strip.' };
  }
  return null;
}

export function usernameFromEmail(email: string): string {
  const base = email.split('@')[0].replace(/[^a-z0-9._-]/gi, '').slice(0, 20);
  const safe = base.length >= 3 ? base : `user${base}`;
  return safe.slice(0, 24);
}
