/**
 * GRIDLOCK LAB — Uncontrolled Controller
 * Greedy entry: vehicles enter as soon as the first quadrant is clear.
 * Models lack of coordination, causing circular wait upon simultaneous arrivals.
 */

import { ControllerContext, ControllerDecisions, IController } from './Controller';
import { ControlMode } from '../types';

export class UncontrolledController implements IController {
  readonly mode: ControlMode = 'uncontrolled';

  reset(): void {}

  update(ctx: ControllerContext): ControllerDecisions {
    const authorizations = new Set<string>();

    const queuedVehicles = ctx.activeVehicles.filter(v => v.state === 'QUEUED');

    for (const v of queuedVehicles) {
      // Only the front vehicle at the stop line of its approach arm can enter
      const isFront = !ctx.activeVehicles.some(
        other => other.id !== v.id && other.originArm === v.originArm && other.state !== 'GONE' && other.pathProgress > v.pathProgress
      );
      if (!isFront) continue;

      const firstQuadId = v.quadrantSequence[0];
      if (!firstQuadId) continue;

      const q = ctx.quadrants.find(item => item.id === firstQuadId);
      if (!q) continue;

      // In uncontrolled mode, enter if first quadrant is free (or flyover is active)
      const isAvailable = ctx.flyoverActive || !q.occupiedBy;
      if (isAvailable) {
        authorizations.add(v.id);
      }
    }

    return { authorizations };
  }
}
