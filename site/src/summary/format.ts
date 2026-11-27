/** Number and date formats for the headlines and tiles. */
export const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
export const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const dayFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", timeZone: "UTC" });

/** "Nov 21, 2026" */
export const day = (date: string) => dayFormat.format(new Date(date));

/** "Nov 2026", from YYYY-MM */
export const month = (key: string) => monthFormat.format(new Date(`${key}-01`));
