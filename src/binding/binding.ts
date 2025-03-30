
export type CompilationContext = Record<string, Constraint[]>;
import { Constraint } from "./constraints";
import { BindingEdge } from "./GraphManager";

export const detectBidirectionalLinks = (edges: BindingEdge[]): Map<string, string> => {
    const bidirectionalPairs = new Map<string, string>();

    // Create a map to track edges for quick lookup
    const edgeMap = new Map<string, Set<string>>();
    for (const edge of edges) {
        const { source, target } = edge;
        if (!edgeMap.has(source.nodeId)) {
            edgeMap.set(source.nodeId, new Set());
        }
        edgeMap.get(source.nodeId)!.add(target.nodeId);
    }

    // Check for bidirectional links
    for (const [sourceId, targets] of edgeMap) {
        for (const targetId of targets) {
            if (edgeMap.get(targetId)?.has(sourceId)) {
                // Found a bidirectional link between sourceId and targetId
                bidirectionalPairs.set(sourceId, targetId);
                bidirectionalPairs.set(targetId, sourceId);
            }
        }
    }

    return bidirectionalPairs;
};

export const createSuperNodeMap = (bidirectionalPairs: Map<string, string>): Map<string, string> => {
    const superNodeMap = new Map<string, string>();
    const visited = new Set<string>();

    for (const [nodeId, pairedNodeId] of bidirectionalPairs) {
        if (!visited.has(nodeId)) {
            // Create a new super node ID
            const superNodeId = `super_${nodeId}`;

            // Map both nodes to the same super node
            superNodeMap.set(nodeId, superNodeId);
            superNodeMap.set(pairedNodeId, superNodeId);

            // Mark both nodes as visited
            visited.add(nodeId);
            visited.add(pairedNodeId);
        }
    }

    return superNodeMap;
};

export const detectAndMergeSuperNodes = (edges: BindingEdge[]): Map<string, string> => {
    // Step 1: Detect bidirectional links
    const bidirectionalPairs = detectBidirectionalLinks(edges);

    // Step 2: Merge bidirectional links into super nodes
    const superNodeMap = createSuperNodeMap(bidirectionalPairs);

    return superNodeMap;
};