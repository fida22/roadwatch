// Dates are plain YYYY-MM-DD strings (stored as UTC date, shown in IST; end date is inclusive).
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export const toDate = (s: string) => parseISO(s);
export const iso = (d: Date) => format(d, "yyyy-MM-dd");
export const addDaysIso = (s: string, n: number) => iso(addDays(parseISO(s), n));
export const daysBetween = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a));
export const pretty = (s: string) => format(parseISO(s), "d MMM yyyy");
export const prettyShort = (s: string) => format(parseISO(s), "d MMM");
export const prettyTime = (s: string) => format(new Date(s), "d MMM yyyy, h:mm a");
export const todayIso = () => iso(new Date());
