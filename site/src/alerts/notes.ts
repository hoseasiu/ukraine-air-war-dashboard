/** Notes and credit shared by the alert line and panel charts. */
import { formatMonth } from "../chart/chartFrame.ts";
import { alertMonthly } from "../data.ts";

export function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

export function alertRangeNote(): string {
  return (
    `Alert figures run from ${formatMonth(alertMonthly.months[0]!)} to ${formatMonth(alertMonthly.months.at(-1)!)}. ` +
    "Widen “Months shown” to include some of them."
  );
}

export function alertCredit(): HTMLParagraphElement {
  return paragraph("Alerts: official file of the Ukrainian air-raid sirens dataset (Vadimkin, MIT license).");
}
