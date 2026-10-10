export const CLOSURE_MATCH_M = 20;  // graph edge is blocked if within this of a full closure
export const CLASH_DISTANCE_M = 20; // same value, used by the conflict engine
export const SNAP_MAX_M = 300;      // origin/destination must be this close to a node
export const WORKS_ALONG_M = 50;    // "works along your route" radius
export const CLOSURE_TYPES = ['none', 'lane_restriction', 'full_closure'] as const;
// Frontend display and map constants
export const STATUS_COLORS: Record<string, string> = {
  planned: '#2563eb',
  ongoing: '#f97316',
  delayed: '#dc2626',
  completed: '#16a34a',
  cancelled: '#9ca3af',
};

export const ROUTE_COLOR = '#7c3aed';
export const BASELINE_COLOR = '#111827';
export const CHENNAI: [number, number] = [13.0827, 80.2707];
export const SIM_NOTE = 'Road network and closures are simulated. Not for real navigation.';
