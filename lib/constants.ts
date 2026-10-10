export const CLOSURE_MATCH_M = 20;  // graph edge is blocked if within this of a full closure
export const CLASH_DISTANCE_M = 20; // same value, used by the conflict engine
export const SNAP_MAX_M = 300;      // origin/destination must be this close to a node
export const WORKS_ALONG_M = 50;    // "works along your route" radius
export const CLOSURE_TYPES = ['none', 'lane_restriction', 'full_closure'] as const;