/**
 * GRIDLOCK LAB — Geometry & Path Generator
 * 1000x1000 logical coordinate space with Left-Hand Traffic (LHT / Indian convention)
 */

import { ArmId, ExitSlotId, MovementType, PathWaypoint, QuadrantId, Vector2D } from './types';

export const WORLD_SIZE = 1000;
export const CENTER: Vector2D = { x: 500, y: 500 };
export const ROAD_WIDTH = 140;
export const HALF_ROAD = ROAD_WIDTH / 2; // 70
export const LANE_OFFSET = 35; // Center of each 70-wide lane

// Box bounds: 430 to 570 in x and y
export const BOX_MIN_X = 430;
export const BOX_MAX_X = 570;
export const BOX_MIN_Y = 430;
export const BOX_MAX_Y = 570;

export const QUADRANT_BOUNDS: Record<QuadrantId, { minX: number; maxX: number; minY: number; maxY: number; center: Vector2D }> = {
  NW: { minX: 430, maxX: 500, minY: 430, maxY: 500, center: { x: 465, y: 465 } },
  NE: { minX: 500, maxX: 570, minY: 430, maxY: 500, center: { x: 535, y: 465 } },
  SE: { minX: 500, maxX: 570, minY: 500, maxY: 570, center: { x: 535, y: 535 } },
  SW: { minX: 430, maxX: 500, minY: 500, maxY: 570, center: { x: 465, y: 535 } }
};

// Stop lines for each arm approach lane (Left-Hand Traffic)
export const STOP_LINES: Record<ArmId, { pos: Vector2D; heading: number }> = {
  N: { pos: { x: 535, y: 420 }, heading: Math.PI / 2 },       // Facing South
  E: { pos: { x: 580, y: 535 }, heading: Math.PI },           // Facing West
  S: { pos: { x: 465, y: 580 }, heading: -Math.PI / 2 },      // Facing North
  W: { pos: { x: 420, y: 465 }, heading: 0 }                  // Facing East
};

// Spawn origins for each arm approach lane
export const SPAWN_ORIGINS: Record<ArmId, Vector2D> = {
  N: { x: 535, y: 20 },
  E: { x: 980, y: 535 },
  S: { x: 465, y: 980 },
  W: { x: 20, y: 465 }
};

// Exit destination endpoints
export const EXIT_DESTINATIONS: Record<ArmId, Vector2D> = {
  N: { x: 465, y: 0 },
  E: { x: 1000, y: 465 },
  S: { x: 535, y: 1000 },
  W: { x: 0, y: 535 }
};

// Exit slot coordinates
export const EXIT_SLOT_COORDS: Record<ExitSlotId, Vector2D> = {
  EXIT_N_0: { x: 465, y: 360 },
  EXIT_N_1: { x: 465, y: 260 },
  EXIT_E_0: { x: 640, y: 465 },
  EXIT_E_1: { x: 740, y: 465 },
  EXIT_S_0: { x: 535, y: 640 },
  EXIT_S_1: { x: 535, y: 740 },
  EXIT_W_0: { x: 360, y: 535 },
  EXIT_W_1: { x: 260, y: 535 }
};

/**
 * Returns the sequence of quadrants required for movement in Left-Hand Traffic.
 */
export function getQuadrantSequence(origin: ArmId, movement: MovementType): QuadrantId[] {
  switch (origin) {
    case 'N': // Enters at NE
      if (movement === 'left') return ['NE']; // Turns to East
      if (movement === 'straight') return ['NE', 'SE']; // Straight to South
      return ['NE', 'SE', 'SW']; // Right turn to West

    case 'E': // Enters at SE
      if (movement === 'left') return ['SE']; // Turns to South
      if (movement === 'straight') return ['SE', 'SW']; // Straight to West
      return ['SE', 'SW', 'NW']; // Right turn to North

    case 'S': // Enters at SW
      if (movement === 'left') return ['SW']; // Turns to West
      if (movement === 'straight') return ['SW', 'NW']; // Straight to North
      return ['SW', 'NW', 'NE']; // Right turn to East

    case 'W': // Enters at NW
      if (movement === 'left') return ['NW']; // Turns to North
      if (movement === 'straight') return ['NW', 'NE']; // Straight to East
      return ['NW', 'NE', 'SE']; // Right turn to South
  }
}

/**
 * Determines target arm based on origin and movement.
 */
export function getTargetArm(origin: ArmId, movement: MovementType): ArmId {
  const armOrder: ArmId[] = ['N', 'E', 'S', 'W'];
  const idx = armOrder.indexOf(origin);
  if (movement === 'straight') return armOrder[(idx + 2) % 4];
  if (movement === 'left') return armOrder[(idx + 1) % 4];
  // right turn
  return armOrder[(idx + 3) % 4];
}

/**
 * Generates smooth path waypoints from spawn to exit destination.
 */
export function generateVehiclePath(origin: ArmId, movement: MovementType): PathWaypoint[] {
  const targetArm = getTargetArm(origin, movement);
  const quadrants = getQuadrantSequence(origin, movement);
  const waypoints: PathWaypoint[] = [];

  // 1. Approach waypoints
  const spawn = SPAWN_ORIGINS[origin];
  const stopLine = STOP_LINES[origin];

  waypoints.push({ x: spawn.x, y: spawn.y });
  waypoints.push({ x: stopLine.pos.x, y: stopLine.pos.y });

  // 2. Traversal waypoints through quadrants
  for (const q of quadrants) {
    const qCenter = QUADRANT_BOUNDS[q].center;
    waypoints.push({ x: qCenter.x, y: qCenter.y, quadrant: q });
  }

  // 3. Exit slot waypoints
  const slot0Id = `EXIT_${targetArm}_0` as ExitSlotId;
  const slot1Id = `EXIT_${targetArm}_1` as ExitSlotId;
  waypoints.push({ ...EXIT_SLOT_COORDS[slot0Id], exitSlot: slot0Id });
  waypoints.push({ ...EXIT_SLOT_COORDS[slot1Id], exitSlot: slot1Id });

  // 4. Final destination endpoint
  const finalDest = EXIT_DESTINATIONS[targetArm];
  waypoints.push({ x: finalDest.x, y: finalDest.y });

  return waypoints;
}

/**
 * Calculates segment lengths, cumulative distances, total path length, and waypoint progress ratios.
 */
export function getPathMetrics(waypoints: PathWaypoint[]): {
  segmentLengths: number[];
  cumulativeDistances: number[];
  totalLength: number;
  waypointProgress: number[];
} {
  const segmentLengths: number[] = [];
  const cumulativeDistances: number[] = [0];
  let totalLength = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dy = waypoints[i + 1].y - waypoints[i].y;
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    totalLength += len;
    cumulativeDistances.push(totalLength);
  }

  const waypointProgress = cumulativeDistances.map(d => totalLength > 0 ? d / totalLength : 0);

  return { segmentLengths, cumulativeDistances, totalLength, waypointProgress };
}

/**
 * Returns progress where the vehicle front touches the stop line.
 */
export function getStopLineProgress(waypoints: PathWaypoint[], vehicleHalfLength: number = 23): number {
  if (waypoints.length < 2) return 0;
  const metrics = getPathMetrics(waypoints);
  const stopDist = Math.max(0, metrics.cumulativeDistances[1] - vehicleHalfLength);
  return metrics.totalLength > 0 ? stopDist / metrics.totalLength : 0;
}

/**
 * Catmull-Rom or Bezier smooth interpolation along waypoints.
 */
export function samplePath(waypoints: PathWaypoint[], progress: number): { pos: Vector2D; heading: number; activeQuadrant?: QuadrantId; activeExitSlot?: ExitSlotId } {
  if (waypoints.length === 0) {
    return { pos: { x: 500, y: 500 }, heading: 0 };
  }
  if (waypoints.length === 1 || progress <= 0) {
    const heading = waypoints.length > 1 ? Math.atan2(waypoints[1].y - waypoints[0].y, waypoints[1].x - waypoints[0].x) : 0;
    return { pos: { x: waypoints[0].x, y: waypoints[0].y }, heading, activeQuadrant: waypoints[0].quadrant, activeExitSlot: waypoints[0].exitSlot };
  }
  if (progress >= 1) {
    const last = waypoints[waypoints.length - 1];
    const prev = waypoints[waypoints.length - 2];
    const heading = Math.atan2(last.y - prev.y, last.x - prev.x);
    return { pos: { x: last.x, y: last.y }, heading, activeQuadrant: last.quadrant, activeExitSlot: last.exitSlot };
  }

  // Calculate cumulative segment lengths
  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dy = waypoints[i + 1].y - waypoints[i].y;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    totalLength += len;
  }

  const targetDist = progress * totalLength;
  let currentDist = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (currentDist + segLen >= targetDist || i === segLengths.length - 1) {
      const segT = segLen > 0 ? (targetDist - currentDist) / segLen : 0;
      const p0 = waypoints[i];
      const p1 = waypoints[i + 1];

      const x = p0.x + (p1.x - p0.x) * segT;
      const y = p0.y + (p1.y - p0.y) * segT;
      const heading = Math.atan2(p1.y - p0.y, p1.x - p0.x);

      // Determine active quadrant or exit slot
      const activeQuadrant = segT < 0.5 ? p0.quadrant : p1.quadrant;
      const activeExitSlot = segT < 0.5 ? p0.exitSlot : p1.exitSlot;

      return { pos: { x, y }, heading, activeQuadrant, activeExitSlot };
    }
    currentDist += segLen;
  }

  const last = waypoints[waypoints.length - 1];
  return { pos: { x: last.x, y: last.y }, heading: 0 };
}
