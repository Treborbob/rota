import { cn } from "cn";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Baby,
  Bath,
  Bed,
  BedDouble,
  Car,
  CookingPot,
  DoorOpen,
  Flower,
  House,
  type LucideIcon,
  Monitor,
  PawPrint,
  Sofa,
  Tag,
  Trees,
  Warehouse,
  WashingMachine,
} from "lucide-react";
import { areaColourClass } from "@/lib/area-style";

const ICONS: Record<string, LucideIcon> = {
  "cooking-pot": CookingPot,
  sofa: Sofa,
  "door-open": DoorOpen,
  "bed-double": BedDouble,
  bed: Bed,
  bath: Bath,
  monitor: Monitor,
  "washing-machine": WashingMachine,
  house: House,
  trees: Trees,
  "arrow-up-to-line": ArrowUpToLine,
  "arrow-down-to-line": ArrowDownToLine,
  car: Car,
  "paw-print": PawPrint,
  flower: Flower,
  warehouse: Warehouse,
  baby: Baby,
  tag: Tag,
};

export function AreaIcon({
  icon,
  className,
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || Tag;
  return <Icon className={className} aria-hidden="true" />;
}

export function AreaChip({
  area,
  className,
}: {
  area: { name: string; icon: string | null; colour: string | null };
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-xs",
        areaColourClass(area.colour),
        className,
      )}
    >
      <AreaIcon icon={area.icon} className="size-3" />
      {area.name}
    </span>
  );
}
