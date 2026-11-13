import {
  Apple,
  Bell,
  Bike,
  BookOpen,
  Boxes,
  CalendarDays,
  Camera,
  CheckSquare,
  Clock,
  Coffee,
  DollarSign,
  Dog,
  Droplets,
  Dumbbell,
  Flag,
  Flame,
  Footprints,
  Gamepad2,
  GraduationCap,
  Hash,
  Heart,
  LayoutGrid,
  Leaf,
  Moon,
  Music,
  Package,
  Pill,
  Plane,
  Repeat,
  ShoppingCart,
  Smile,
  Sparkles,
  Star,
  Sun,
  Tally5,
  Target,
  Ticket,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Every icon a counter can use. Keys are stored in saved counters, so never rename them. */
const ICONS: Record<string, LucideIcon> = {
  hash: Hash,
  timer: Timer,
  target: Target,
  trophy: Trophy,
  repeat: Repeat,
  'layout-grid': LayoutGrid,
  tally: Tally5,
  droplets: Droplets,
  'check-square': CheckSquare,
  dumbbell: Dumbbell,
  boxes: Boxes,
  package: Package,
  sparkles: Sparkles,
  ticket: Ticket,
  users: Users,
  heart: Heart,
  star: Star,
  flame: Flame,
  zap: Zap,
  coffee: Coffee,
  book: BookOpen,
  music: Music,
  footprints: Footprints,
  bike: Bike,
  pill: Pill,
  moon: Moon,
  sun: Sun,
  apple: Apple,
  cart: ShoppingCart,
  graduation: GraduationCap,
  gamepad: Gamepad2,
  dog: Dog,
  plane: Plane,
  camera: Camera,
  leaf: Leaf,
  smile: Smile,
  flag: Flag,
  dollar: DollarSign,
  calendar: CalendarDays,
  clock: Clock,
  bell: Bell,
};

export const ICON_KEYS: string[] = Object.keys(ICONS);

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Hash;
}

export function CounterIcon({
  name,
  size = 20,
  className,
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = iconFor(name);
  return <Icon size={size} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
