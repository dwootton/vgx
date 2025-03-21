import { BindingEdge } from "./GraphManager";
import { extractAnchorType, isCompatible } from "./cycles_CLEAN";
/**
 * Prunes edges that are not reachable from the root component.
 * Returns both valid edges and implicit edges (pruned edges that might be needed later).
 * 
 * @param rootId The ID of the root component
 * @param edges All binding edges in the graph
 * @returns Object containing valid edges and implicit edges
 */
export function pruneEdges(rootId: string, edges: BindingEdge[]): BindingEdge[] {
    // Start at the root id and determine which anchors are valid
    const validEdges = new Set<BindingEdge>();
    const visitedNodes = new Set<string>();

    
    // Helper function to recursively validate edges
    function validateEdgesForNode(nodeId: string, validChannels: Set<string>) {
        if (visitedNodes.has(nodeId)) return;
        visitedNodes.add(nodeId);
        
        // Find all edges where this node is the source
        const outgoingEdges = edges.filter(edge => edge.source.nodeId === nodeId);
        
        for (const edge of outgoingEdges) {
            const sourceChannel = extractAnchorType(edge.source.anchorId);
            const targetChannel = extractAnchorType(edge.target.anchorId);
            
            // If the source channel is valid, this edge is valid
            if (sourceChannel && validChannels.has(sourceChannel)) {
                validEdges.add(edge);
                
                // The target node can now use this channel
                const targetValidChannels = new Set(validChannels);
                if (targetChannel) {
                    targetValidChannels.add(targetChannel);
                }
                
                // Recursively validate edges for the target node
                validateEdgesForNode(edge.target.nodeId, targetValidChannels);
            }
        }
    }
    
    // Start with the root node's channels
    const rootChannels = new Set<string>();
    
    // Find all edges where root is the source to determine valid channels
    edges.filter(edge => edge.source.nodeId === rootId).forEach(edge => {
        const channel = extractAnchorType(edge.source.anchorId);
        if (channel) rootChannels.add(channel);
    });

    console.log('before target', edges.filter(edge => edge.target.nodeId === rootId))
    
    // Also include edges where root is the target
    edges.filter(edge => edge.target.nodeId === rootId).forEach(edge => {
        const channel = extractAnchorType(edge.target.anchorId);
        if (channel) rootChannels.add(channel);
    });

    console.log('after target', edges, rootChannels, rootId)
    
    // Start validation from the root
    validateEdgesForNode(rootId, rootChannels);
    
    const prunedEdges = edges.filter(edge => validEdges.has(edge));
    const implicitEdges = edges.filter(edge => !validEdges.has(edge));
    
    
    return prunedEdges;
}