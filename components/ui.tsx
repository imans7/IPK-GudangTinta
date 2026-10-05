import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "primary", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "danger" }) {
  const v = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:pointer-events-none", v, className)} {...p} />;
}

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(field, className)} {...p} />);
Input.displayName = "Input";
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className={cn(field, className)} {...p} />;

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label className={cn("mb-1 block text-sm font-medium text-slate-700", className)} {...p} />;

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)} {...p} />;

// Tabel gaya shadcn
export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => <div className="w-full overflow-x-auto"><table className={cn("w-full border-collapse text-sm", className)} {...p} /></div>;
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="bg-slate-100 text-slate-700" {...p} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y divide-slate-200" {...p} />;
export const TR = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("hover:bg-slate-50", className)} {...p} />;
export const TH = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn("whitespace-nowrap border border-slate-200 px-3 py-2 text-left font-semibold", className)} {...p} />;
export const TD = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("border border-slate-200 px-3 py-2", className)} {...p} />;
export const Empty = ({ cols, text }: { cols: number; text: string }) => <tr><td colSpan={cols} className="px-3 py-8 text-center text-slate-500">{text}</td></tr>;
