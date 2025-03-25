import { BindingEdge, BindingNode } from "./GraphManager";
import { extractAnchorType, isAnchorTypeCompatible } from "./cycles";
/**
 * Prunes edges that are not reachable from the root component.
 * Returns both valid edges and implicit edges (pruned edges that might be needed later).
 * 
 * @param rootId The ID of the root component
 * @param edges All binding edges in the graph
 * @returns Object containing valid edges and implicit edges
 */
export function pruneEdges(nodes: BindingNode[], edges: BindingEdge[], rootId: string): BindingEdge[] {
    // Create a set of valid node IDs from the provided nodes
    const validNodeIds = new Set<string>(nodes.map(node => node.id));
    // Start with the root node's channels

    const rootChannels = new Set<string>();
    
    console.log('pruningedges',edges, rootId)
    // Find all edges where root is the source to determine valid channels
    edges.filter(edge => edge.source.nodeId === rootId).forEach(edge => {
        const channel = extractAnchorType(edge.source.anchorId);
        if (channel) rootChannels.add(channel);
    });
    
    // Also include edges where root is the target
    edges.filter(edge => edge.target.nodeId === rootId).forEach(edge => {
        const channel = extractAnchorType(edge.target.anchorId);
        if (channel) rootChannels.add(channel);
    });

    rootChannels.add('data')
    rootChannels.add('text')

    console.log('rootChannels',rootChannels)
    // Filter edges based on anchor type compatibility and valid nodes
    const validEdges: BindingEdge[] = [];
    
    for (const edge of edges) {
        const sourceNodeId = edge.source.nodeId;
        const targetNodeId = edge.target.nodeId;
        
        // Skip edges where either node doesn't exist in our valid nodes list
        if (!validNodeIds.has(sourceNodeId) || !validNodeIds.has(targetNodeId)) {
            continue;
        }
        
        const sourceAnchorType = extractAnchorType(edge.source.anchorId);
        const targetAnchorType = extractAnchorType(edge.target.anchorId);
        
        // Keep edges where both anchor types are defined and compatible
        if (sourceAnchorType && targetAnchorType && isAnchorTypeCompatible(edge.source.anchorId, edge.target.anchorId) && rootChannels.has(sourceAnchorType)) {
            validEdges.push(edge);
        }
    }
    
    return validEdges;
}