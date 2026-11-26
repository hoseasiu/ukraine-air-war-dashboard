/** A segmented control: native radio buttons drawn as one row of segments. */
import { create } from "../strikes/shared.ts";
import "./segmented.css";

let groups = 0;

export function segmented(
  label: string,
  options: readonly (readonly [value: string, text: string])[],
  value: string,
  onChange: (value: string) => void,
): HTMLFieldSetElement {
  const group = create("fieldset", "segmented");
  const name = `segmented-${++groups}`;
  const row = create("div", "segments");
  for (const [optionValue, text] of options) {
    const segment = create("label");
    const input = create("input");
    input.type = "radio";
    input.name = name;
    input.value = optionValue;
    input.checked = optionValue === value;
    input.addEventListener("change", () => onChange(optionValue));
    segment.append(input, create("span", "", text));
    row.append(segment);
  }
  group.append(create("legend", "", label), row);
  return group;
}
