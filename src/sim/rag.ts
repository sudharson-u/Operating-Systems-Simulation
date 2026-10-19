/**
 * GRIDLOCK LAB — Resource Allocation Graph & Wait-For Cycle Detector
 * Implements Operating Systems bipartite RAG and Tarjan/DFS cycle detection
 */

import { RAGEdge, RAGGraph, RAGNode, QuadrantResource, ExitSlotResource, Vehicle } from './types';

/**
 * Detects cycles in a directed graph using Depth-First Search with recursion stack tracking.
 * Returns the cycle path (ordered array of node IDs), or empty array if acyclic.
 */
export function findDirectedCycle(adj: Map<string, string[]>): string[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parent = new Map<string, string>();
  let cycleNodes: string[] = [];

  function dfs(curr: string): boolean {
    visited.add(curr);
    inStack.add(curr);

    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        parent.set(next, curr);
        if (dfs(next)) return true;
      } else if (inStack.has(next)) {
        // Cycle detected: backtrack from curr up to next
        const path: string[] = [next];
        let p = curr;
        while (p !== next && parent.has(p)) {
          path.push(p);
          p = parent.get(p)!;
        }
        path.push(next);
        cycleNodes = path.reverse();
        return true;
      }
    }

    inStack.delete(curr);
    return false;
  }

  // Iterate over nodes in sorted order for determinism
  const allNodes = Array.from(adj.keys()).sort();
  for (const node of allNodes) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        // Return unique cycle nodes in order without repeating last node
        if (cycleNodes.length > 1 && cycleNodes[0] === cycleNodes[cycleNodes.length - 1]) {
          cycleNodes.pop();
        }
        return cycleNodes;
      }
    }
  }

  return [];
}

/**
 * Builds the live Resource Allocation Graph (RAG) and derived Wait-For Graph.
 */
export function buildRAG(
  vehicles: Vehicle[],
  quadrants: QuadrantResource[],
  exitSlots: ExitSlotResource[]
): { rag: RAGGraph; waitForCycle: string[]; waitForEdges: { from: string; to: string; isCycle: boolean }[] } {
  const nodes: RAGNode[] = [];
  const edges: RAGEdge[] = [];

  // Build resource holders lookup
  const resourceHolder = new Map<string, string>(); // resourceId -> vehicleId

  // Quadrant nodes and assignments
  for (const q of quadrants) {
    nodes.push({
      id: q.id,
      type: 'resource',
      label: q.id,
      color: '#33555B',
      isCycle: false
    });
    if (q.occupiedBy) {
      resourceHolder.set(q.id, q.occupiedBy);
      // Assignment edge: Resource -> Process
      edges.push({
        from: q.id,
        to: q.occupiedBy,
        type: 'assignment',
        isCycle: false
      });
    }
  }

  // Exit slot nodes and assignments
  for (const es of exitSlots) {
    nodes.push({
      id: es.id,
      type: 'resource',
      label: es.id.replace('EXIT_', 'E_'),
      color: '#1A363B',
      isCycle: false
    });
    if (es.occupiedBy) {
      resourceHolder.set(es.id, es.occupiedBy);
      edges.push({
        from: es.id,
        to: es.occupiedBy,
        type: 'assignment',
        isCycle: false
      });
    }
  }

  // Process nodes (vehicles active on road or in box)
  const activeVehicles = vehicles.filter(v => v.state !== 'GONE');
  const waitForAdj = new Map<string, string[]>();

  for (const v of activeVehicles) {
    nodes.push({
      id: v.id,
      type: 'process',
      label: v.label,
      color: v.color,
      isCycle: false
    });
    if (!waitForAdj.has(v.id)) {
      waitForAdj.set(v.id, []);
    }

    // Process requests
    if (v.requestedQuadrant) {
      edges.push({
        from: v.id,
        to: v.requestedQuadrant,
        type: 'request',
        isCycle: false
      });

      const holder = resourceHolder.get(v.requestedQuadrant);
      if (holder && holder !== v.id) {
        waitForAdj.get(v.id)!.push(holder);
      }
    }

    if (v.requestedExitSlot) {
      edges.push({
        from: v.id,
        to: v.requestedExitSlot,
        type: 'request',
        isCycle: false
      });

      const holder = resourceHolder.get(v.requestedExitSlot);
      if (holder && holder !== v.id) {
        waitForAdj.get(v.id)!.push(holder);
      }
    }
  }

  // Run cycle detection on the Wait-For graph
  const cycle = findDirectedCycle(waitForAdj);
  const cycleSet = new Set(cycle);

  // Mark cycle on nodes
  for (const node of nodes) {
    if (node.type === 'process' && cycleSet.has(node.id)) {
      node.isCycle = true;
    }
  }

  // Derive wait-for edges
  const waitForEdges: { from: string; to: string; isCycle: boolean }[] = [];
  for (const [from, toList] of waitForAdj.entries()) {
    for (const to of toList) {
      const isCycleEdge = cycleSet.has(from) && cycleSet.has(to) &&
        (cycle.indexOf(to) === (cycle.indexOf(from) + 1) % cycle.length);
      waitForEdges.push({ from, to, isCycle: isCycleEdge });
    }
  }

  // Also tag cycle edges in RAG
  for (const edge of edges) {
    if (edge.type === 'request' && cycleSet.has(edge.from)) {
      const holder = resourceHolder.get(edge.to);
      if (holder && cycleSet.has(holder)) {
        edge.isCycle = true;
      }
    } else if (edge.type === 'assignment' && cycleSet.has(edge.to)) {
      // If resource is requested by someone else in the cycle
      edge.isCycle = true;
    }
  }

  return {
    rag: { nodes, edges, cycle },
    waitForCycle: cycle,
    waitForEdges
  };
}
