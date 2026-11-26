import { withTerms } from "../glossary/popover.ts";
import type { TermId } from "../glossary/terms.ts";

/** Discussion prompts as a list. */
export function promptList(prompts: readonly string[]): HTMLUListElement {
  const list = document.createElement("ul");
  const seen = new Set<TermId>();
  for (const prompt of prompts) {
    const item = document.createElement("li");
    item.append(...withTerms(prompt, seen));
    list.append(item);
  }
  return list;
}
