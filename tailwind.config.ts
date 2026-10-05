import type { Config } from "tailwindcss";

// Palet slate dibaca dari variabel CSS (lihat app/globals.css), jadi seluruh kelas slate-* yang sudah ada
// otomatis berganti saat <html class="dark">. Tidak perlu menambah "dark:" di setiap komponen.
const slate = Object.fromEntries(
  ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"].map((n) => [n, `rgb(var(--slate-${n}) / <alpha-value>)`]),
);

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { slate } } },
  plugins: [],
} satisfies Config;
