import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLOR_PALETTES = [
  {
    key: "rose",
    card: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    badge: "bg-rose-100/80 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 border-rose-300/80 dark:border-rose-700/60",
  },
  {
    key: "blue",
    card: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100/80 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300/80 dark:border-blue-700/60",
  },
  {
    key: "emerald",
    card: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-300/80 dark:border-emerald-700/60",
  },
  {
    key: "amber",
    card: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300/80 dark:border-amber-700/60",
  },
  {
    key: "purple",
    card: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    badge: "bg-purple-100/80 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-300/80 dark:border-purple-700/60",
  },
  {
    key: "indigo",
    card: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    badge: "bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border-indigo-300/80 dark:border-indigo-700/60",
  },
  {
    key: "pink",
    card: "bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
    badge: "bg-pink-100/80 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200 border-pink-300/80 dark:border-pink-700/60",
  },
  {
    key: "cyan",
    card: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    badge: "bg-cyan-100/80 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 border-cyan-300/80 dark:border-cyan-700/60",
  },
  {
    key: "teal",
    card: "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    badge: "bg-teal-100/80 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border-teal-300/80 dark:border-teal-700/60",
  },
  {
    key: "orange",
    card: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    badge: "bg-orange-100/80 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border-orange-300/80 dark:border-orange-700/60",
  },
  {
    key: "fuchsia",
    card: "bg-fuchsia-50 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800",
    badge: "bg-fuchsia-100/80 dark:bg-fuchsia-900/50 text-fuchsia-800 dark:text-fuchsia-200 border-fuchsia-300/80 dark:border-fuchsia-700/60",
  },
  {
    key: "sky",
    card: "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    badge: "bg-sky-100/80 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 border-sky-300/80 dark:border-sky-700/60",
  },
];

const getSubjectPaletteIndex = (subjectName: string) => {
  if (!subjectName) return 0;
  let hash = 0;
  const name = subjectName.trim().toLowerCase();
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
  }
  return (hash >>> 0) % COLOR_PALETTES.length;
};

export const getSubjectColor = (subjectName: string) => {
  if (!subjectName) return COLOR_PALETTES[0].card;
  if (subjectName.includes('(THI)')) return "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800";
  
  const index = getSubjectPaletteIndex(subjectName);
  return COLOR_PALETTES[index].card;
};

export const getSubjectBadgeColor = (subjectName: string) => {
  if (!subjectName) return COLOR_PALETTES[0].badge;
  if (subjectName.includes('(THI)')) return "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800";

  const index = getSubjectPaletteIndex(subjectName);
  return COLOR_PALETTES[index].badge;
};

/**
 * Normalizes subject names and fixes common Unicode/encoding mojibake
 * e.g., 'Triết học Mác - Lnin' -> 'Triết học Mác - Lê-nin'
 */
export function normalizeSubjectName(rawName: string): string {
  if (!rawName) return '';
  let str = String(rawName).trim();

  // Fix Unicode replacement characters (\uFFFD or ?)
  // Pattern: Triết học Mác - Lnin / Lnin / L?nin -> Triết học Mác - Lê-nin
  str = str.replace(/Triết\s*học\s*Mác\s*-\s*L[\uFFFD?]{1,3}nin/gi, 'Triết học Mác - Lê-nin');
  str = str.replace(/Mác\s*-\s*L[\uFFFD?]{1,3}nin/gi, 'Mác - Lê-nin');
  str = str.replace(/\bL[\uFFFD?]{1,3}nin\b/gi, 'Lê-nin');

  // Generic replacement character \uFFFD in common Vietnamese university subjects
  str = str.replace(/Kinh\s*t[\uFFFD?]\s*ch[\uFFFD?]/gi, 'Kinh tế chính trị');
  str = str.replace(/Ch[\uFFFD?]\s*ngh[\uFFFD?]\s*x[\uFFFD?]\s*h[\uFFFD?]/gi, 'Chủ nghĩa xã hội');
  str = str.replace(/T[\uFFFD?]\s*t[\uFFFD?]\s*ng\s*H[\uFFFD?]\s*Ch[\uFFFD?]\s*Minh/gi, 'Tư tưởng Hồ Chí Minh');
  str = str.replace(/Đ[\uFFFD?]\s*ng\s*C[\uFFFD?]\s*ng\s*s[\uFFFD?]/gi, 'Đảng Cộng sản');
  str = str.replace(/L[\uFFFD?]\s*thuy[\uFFFD?]/gi, 'Lý thuyết');
  str = str.replace(/Th[\uFFFD?]\s*c\s*h[\uFFFD?]/gi, 'Thực hành');

  // If there are still lone \uFFFD characters between valid Vietnamese consonants, clean up
  str = str.replace(/[\uFFFD]+/g, '');

  // Normalize multiple spaces
  str = str.replace(/\s+/g, ' ').trim();

  return str;
}

/**
 * Checks if a subject is an invalid/administrative dummy entry (such as BC11110)
 */
export function isInvalidSubject(name?: string, code?: string): boolean {
  const n = String(name || '').trim().toUpperCase();
  const c = String(code || '').trim().toUpperCase();
  if (!n && !c) return true;
  if (n === 'BC11110' || c.includes('BC11110') || /^BC\d{4,}/i.test(n) || /^BC\d{4,}/i.test(c)) {
    return true;
  }
  return false;
}
