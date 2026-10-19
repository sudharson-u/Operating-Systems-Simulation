/**
 * GRIDLOCK LAB — Roundabout Controller
 * Clockwise circulation for Left-Hand Traffic with yield-at-entry.
 * Demonstrates: Eliminates crossing conflicts, but downstream exit blockage causes ring saturation.
 */

import { ControllerContext, ControllerDecisions, IController } from './Controller';
import { ControlMode } from '../types';

export class RoundaboutController implements IController {
  readonly mode: ControlMode = 'roundabout';

  reset(): void {}

  update(ctx: ControllerContext): ControllerDecisions {
    const authorizations = new Set<string>();

    const queuedVehicles = ctx.activeVehicles.filter(v => v.state === 'QUEUED');

    // Circulating vehicles in the box
    const inBoxVehicles = ctx.activeVehicles.filter(v => v.state === 'IN_BOX' || v.state === 'ENTERING');

    for (const v of queuedVehicles) {
      // Only the front vehicle at the stop line of its approach arm can enter
      const isFront = !ctx.activeVehicles.some(
        other => other.id !== v.id && other.originArm === v.originArm && other.state !== 'GONE' && other.pathProgress > v.pathProgress
      );
      if (!isFront) continue;

      const entryQuadId = v.quadrantSequence[0];
      const q = ctx.quadrants.find(item => item.id === entryQuadId);
      if (!q) continue;

      if (!ctx.flyoverActive && (q.occupiedBy || q.reservedBy)) {
        continue;
      }

      // In roundabout, yield to circulating vehicles about to enter or already in this quadrant
      // Clockwise precedence in LHT:
      // NE is fed from NW
      // SE is fed from NE
      // SW is fed from SE
      // NW is fed from SW
      const upstreamQuadMap: Record<string, string> = {
        NE: 'NW',
        SE: 'NE',
        SW: 'SE',
        NW: 'SW'
      };

      const upstreamQuadId = upstreamQuadMap[entryQuadId];
      const hasCirculatingConflict = inBoxVehicles.some(ib => {
        return (ib.heldQuadrant === upstreamQuadId && ib.requestedQuadrant === entryQuadId) ||
               (ib.heldQuadrant === entryQuadId);
      });

      if (hasCirculatingConflict && !ctx.flyoverActive) {
        continue; // Yield to circulating traffic
      }

      // Check Yellow-Box rule if active
      if (ctx.yellowBoxRule) {
        const exitSlotId = `EXIT_${v.targetArm}_0`;
        const slot = ctx.exitSlots.find(s => s.id === exitSlotId);
        if (slot && (slot.occupiedBy || slot.isBlockedByDownstream)) {
          continue;
        }
      }

      authorizations.add(v.id);
    }

    return { authorizations };
  }
}
