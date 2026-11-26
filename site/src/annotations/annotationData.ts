/**
 * The cited event annotations (data/reference/annotations.md). The site shows
 * only rows that are verified and approved by the owner.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { csvParse } from "d3-dsv";

export interface Annotation {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  /** What the date refers to, such as an announcement or the event itself. */
  dateMarks: string;
  label: string;
  description: string;
  /** One or two citations, shown with the event. */
  sources: string[];
}

/** The annotations the site may show, oldest first. */
export function parseAnnotations(csv: string): Annotation[] {
  const shown = csvParse(csv).filter((row) => row.verification === "verified" && row.owner_review === "approved");
  const annotations = shown.map((row) => {
    const { id, date, label, description, date_marks: dateMarks } = row;
    const sources = [row.source_url, row.source_url_2].filter((url) => !!url) as string[];
    const where = `annotations.csv: ${id || "a row with no id"}`;
    if (!id || !label) throw new Error(`${where}: a shown row needs an id and a label`);
    if (!description || !dateMarks) throw new Error(`${where}: a shown row needs a description and date_marks`);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      throw new Error(`${where}: a shown row needs a YYYY-MM-DD date`);
    }
    if (!row.source_url || !sources.every((url) => url.startsWith("https://"))) {
      throw new Error(`${where}: a shown row needs a citation, and every citation an https link`);
    }
    return { id, date, dateMarks, label, description, sources };
  });
  if (!annotations.length) throw new Error("annotations.csv: no row is both verified and approved");
  return annotations.sort((a, b) => a.date.localeCompare(b.date));
}
