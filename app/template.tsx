/**
 * Transisi antar halaman.
 *
 * Sengaja dibuat sebagai Server Component: sebelumnya template ini adalah
 * Client Component berbasis `motion` yang menambahkan boundary hydration dan
 * menganimasikan `transform` pada seluruh dokumen setiap navigasi. Sekarang
 * hanya opacity lewat CSS animation, jadi nol JavaScript tambahan dan tidak
 * ada layer besar yang dibuat ulang.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
