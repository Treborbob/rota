/**
 * Idempotent seed: the household row and the default areas.
 * Users are created on first sign-in (see lib/auth.ts); tasks come from the UI.
 *
 *   pnpm db:seed
 */
import { db } from "../lib/db";

const HOUSEHOLD_NAME = "Black Family";

const AREAS: Array<{ name: string; icon: string; colour: string }> = [
  { name: "Kitchen", icon: "cooking-pot", colour: "amber" },
  { name: "Lounge", icon: "sofa", colour: "rose" },
  { name: "Hall & Stairs", icon: "door-open", colour: "stone" },
  { name: "Main Bedroom", icon: "bed-double", colour: "violet" },
  { name: "Other Bedrooms", icon: "bed", colour: "indigo" },
  { name: "Bathrooms", icon: "bath", colour: "sky" },
  { name: "Office", icon: "monitor", colour: "teal" },
  { name: "Utility & Appliances", icon: "washing-machine", colour: "lime" },
  { name: "Whole House", icon: "house", colour: "orange" },
  { name: "Outside", icon: "trees", colour: "emerald" },
];

async function main() {
  const existing = await db.household.findFirst();
  if (!existing) {
    await db.household.create({ data: { name: HOUSEHOLD_NAME } });
    console.log(`Created household "${HOUSEHOLD_NAME}"`);
  } else {
    console.log(`Household "${existing.name}" already exists`);
  }

  let created = 0;
  for (const [i, area] of AREAS.entries()) {
    const found = await db.area.findFirst({ where: { name: area.name } });
    if (found) continue;
    await db.area.create({ data: { ...area, sortOrder: (i + 1) * 10 } });
    created += 1;
  }
  console.log(
    `Areas: ${created} created, ${AREAS.length - created} already present`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
