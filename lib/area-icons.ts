/** Icon keys an area may use, with labels for the picker. Pure; client-safe. */
export const AREA_ICONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "house", label: "House" },
  { key: "cooking-pot", label: "Kitchen" },
  { key: "sofa", label: "Lounge" },
  { key: "door-open", label: "Hall" },
  { key: "bed-double", label: "Bedroom" },
  { key: "bed", label: "Spare bed" },
  { key: "bath", label: "Bathroom" },
  { key: "monitor", label: "Office" },
  { key: "washing-machine", label: "Utility" },
  { key: "trees", label: "Outside" },
  { key: "arrow-up-to-line", label: "Upstairs" },
  { key: "arrow-down-to-line", label: "Downstairs" },
  { key: "car", label: "Car" },
  { key: "paw-print", label: "Pets" },
  { key: "flower", label: "Garden" },
  { key: "warehouse", label: "Garage" },
  { key: "baby", label: "Kids" },
  { key: "tag", label: "Plain tag" },
];

export const AREA_ICON_KEYS: string[] = AREA_ICONS.map((i) => i.key);
