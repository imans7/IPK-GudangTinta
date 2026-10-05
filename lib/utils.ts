import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export const fmtNum = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 3 });
export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jakarta" });
export const todayInput = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }); // yyyy-mm-dd
export const round3 = (n: number) => Math.round(n * 1000) / 1000;
