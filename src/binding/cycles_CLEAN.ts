import { BindingEdge, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager } from "./BindingManager";
import { BaseComponent } from "../components/base";
import { createMergedComponent } from "./mergedComponent_CLEAN";
// import { expandEdges } from "./SpecCompiler";
import { getChannelFromEncoding } from "../utils/anchorGeneration/rectAnchors";

export function expandEdges(edges: BindingEdge[]): BindingEdge[] {  
    console.log('expanding edges2', JSON.parse(JSON.stringify(edges)))
    const expanded= edges.flatMap(edge => {
        const sourceComponent = BindingManager.getInstance().getComponent(edge.source.nodeId);
        if (!sourceComponent) {
            throw new Error(`Source component ${edge.source.nodeId} not found`);
        }
        const targetComponent = BindingManager.getInstance().getComponent(edge.target.nodeId);
        if (!targetComponent) {
            throw new Error(`Target component ${edge.target.nodeId} not found`);
        }
        return expandGroupAnchors(edge, sourceComponent, targetComponent)
    })
    
    console.log('expanded edges', JSON.parse(JSON.stringify(edges)), JSON.parse(JSON.stringify(expanded)))
    
    return expanded.filter(e => e.source.anchorId !== '_all' || e.target.anchorId !== '_all');;
}


// Interactor schema fn 
function expandGroupAnchors(edge: BindingEdge, source: BaseComponent, target: BaseComponent): BindingEdge[] {
    // Helper function to get anchors based on configuration ID or _all
    const getAnchors = (component: BaseComponent, anchorId: string) => {
        console.log('dsadadsad', component, anchorId)
        // If it's _all, return all anchors
        if (anchorId === '_all') {
            console.log('dsadadsad in all', component.getAnchors())
            return [...component.getAnchors().values()].map(a => a.id.anchorId);
        }

        console.log('dsfsfsdfsd config', component, 'anchorId', component.configurations)

        if(component.configurations[anchorId]) {
            console.log('dsadadsad in config', component.configurations)

            const componentAnchors = [...component.getAnchors().values()]
            const filteredAnchors = componentAnchors.filter(a => a.id.anchorId.includes(anchorId) && a.id.anchorId !== anchorId)
            const mappedAnchors = filteredAnchors.map(a => a.id.anchorId)
            console.log('dasdas',anchorId, componentAnchors, 'filteredAnchors', filteredAnchors, 'mappedAnchors', mappedAnchors)
            return mappedAnchors
        }
        
        // Check if anchorId matches a configuration ID (like 'span')
        // If so, find all anchors that contain this ID (like 'span_x', 'span_y')
        const configAnchors = [...component.getAnchors().values()]
            .filter(a => a.id.anchorId.includes(anchorId) && a.id.anchorId !== anchorId)
            .map(a => a.id.anchorId);
            
        // If we found configuration-based anchors, return those
        if (configAnchors.length > 0) {
            console.log('dsadadsad', configAnchors)
            return configAnchors;
        }

        console.log('dsadadsad retunr original', anchorId)

        const baseAnchorId = anchorId
        console.log('dsadadsad baseAnchorId', baseAnchorId)
        try {
            component.getAnchor(baseAnchorId); // This will throw if anchor doesn't exist
            console.log('dsadadsaddasdsa', baseAnchorId, component, component.getAnchor(baseAnchorId))
            return [baseAnchorId];
        } catch (error) {
            // Anchor doesn't exist, continue with empty array
            console.log('Anchor not found:', baseAnchorId);
            return [];
        }
        
    };

    const sourceAnchors = getAnchors(source, edge.source.anchorId);
    let targetAnchors = getAnchors(target, edge.target.anchorId);

    console.log('dssdfsa', targetAnchors, target, 'sourceAnchors', sourceAnchors, source)
    // Filter targetAnchors to only include those that match configurations referenced in original edges
    
    console.log('wdsdsf', sourceAnchors, 'targetAnchors', targetAnchors)

    function isCompatible(sourceAnchorId: string, targetAnchorId: string) {
        // Extract the base channel from anchor IDs of various formats
        function extractChannel(anchorId: string): string | undefined {
            if (anchorId === '_all') return undefined;
            console.log('extracting anchorId', anchorId)
            // If it's a simple channel name like 'x', 'y', return as is
            if (['x', 'y', 'color', 'size', 'shape', 'x1', 'x2', 'y1', 'y2'].includes(anchorId)) {
                return anchorId;
            }
            
            // For complex IDs like 'point_x', 'span_pla_x', extract the last part
            const parts = anchorId.split('_');
            const lastPart = parts[parts.length - 1];
            
            // Return the last part if it's a valid channel, otherwise undefined
            return ['x', 'y', 'color', 'size', 'shape', 'x1', 'x2', 'y1', 'y2'].includes(lastPart) 
                ? lastPart 
                : undefined;
        }
        
        console.log('fdsfkljsdlk', sourceAnchorId, 'targetAnchorId', targetAnchorId)
        const sourceChannel = extractChannel(sourceAnchorId);
        const targetChannel = extractChannel(targetAnchorId);
        console.log('sourceChannel', sourceChannel, 'targetChannel', targetChannel)
        if(!sourceChannel || !targetChannel) {
            return false;
        }
        console.log('isCompatifsdfsble', sourceAnchorId, 'targetAnchorId', targetAnchorId, 'channel',sourceChannel, 'targetChannel', targetChannel, getChannelFromEncoding(sourceChannel),getChannelFromEncoding(targetChannel))
        return getChannelFromEncoding(sourceChannel) == getChannelFromEncoding(targetChannel);
    }

    console.log('sourceAnchorsFIMAL', sourceAnchors, 'targetAnchors', targetAnchors)
    return sourceAnchors.flatMap(sourceAnchor =>
        targetAnchors
            .filter(targetAnchor => isCompatible(sourceAnchor, targetAnchor))
            .map(targetAnchor => ({
                source: { nodeId: edge.source.nodeId, anchorId: sourceAnchor },
                target: { nodeId: edge.target.nodeId, anchorId: targetAnchor }
            }))
    );
}

/**
 * Detects cycles in a binding graph and transforms it to resolve them.
 * 
 * @param bindingGraph The original binding graph
 * @param bindingManager The binding manager instance
 * @returns Transformed binding graph with cycles resolved
 */
export function resolveCycles(
    bindingGraph: BindingGraph,
    bindingManager: BindingManager
): BindingGraph {
    // Make deep copies to avoid modifying the original
    let { nodes, edges } = cloneGraph(bindingGraph);

    // Find all cycles in the graph
    const cycles = detectCyclesByChannel(edges);

    if (cycles.length === 0) {
        return bindingGraph; // No cycles to resolve
    }


    // Process each cycle
    let transformedGraph: BindingGraph = { nodes, edges };

    for (const cycle of cycles) {
        transformedGraph = resolveCycle(transformedGraph, cycle, bindingManager);
    }

    return transformedGraph;
}

/**
 * Resolves a single cycle by creating a merged node and rewiring connections.
 */
function resolveCycle(
    graph: BindingGraph,
    cycle: { nodes: string[], edges: BindingEdge[] },
    bindingManager: BindingManager
): BindingGraph {
    const { nodes, edges } = graph;
    const cycleNodesArray = [...cycle.nodes];

    // Only handle 2-node cycles for now (most common case)
    if (cycleNodesArray.length !== 2) {
        console.warn("Only 2-node cycles are supported for automatic resolution");
        return graph;
    }

    const [node1Id, node2Id] = cycleNodesArray;
    const targetAnchorId = cycle.edges[0].target.anchorId;

    // Create merged component
    const mergedComponent = createMergedComponent(
        node1Id,
        node2Id,
        targetAnchorId,
        bindingManager
    );


    // Add merged component to binding manager
    bindingManager.addComponent(mergedComponent);

    // Add merged node to graph
    const newNodes = nodes.map(node => ({
        id: node.id,
        type: node.type
    }));
    newNodes.push({
        id: mergedComponent.id,
        type: 'merged'
    });

    // Filter out direct cycle edges
    const newEdges = filterOutCycleEdges(edges, cycle);
    // Create internal anchors and rewire connections
    rewireNodeConnections(
        newEdges,
        node1Id,
        node2Id,
        targetAnchorId,
        mergedComponent.id,
        bindingManager
    );


    return { nodes: newNodes, edges: newEdges };
}

/**
 * Detects cycles in the graph, grouped by channel.
 * This ensures we only create merged nodes for genuine cycles, not
 * just any bidirectional connection.
 */
function detectCyclesByChannel(edges: BindingEdge[]): Array<{ nodes: string[], edges: BindingEdge[] }> {
    const cycles: Array<{ nodes: string[], edges: BindingEdge[] }> = [];

    // Group edges by anchor ID
    const edgesByAnchor = new Map<string, BindingEdge[]>();
    const anchorIds = new Set<string>();

    // Extract all unique anchor IDs
    edges.forEach(edge => {
        anchorIds.add(edge.source.anchorId);
    });

    // Partition edges by anchor ID
    anchorIds.forEach(anchorId => {
        const filteredEdges = edges.filter(edge =>
            edge.source.anchorId === anchorId && edge.target.anchorId === anchorId
        );
        edgesByAnchor.set(anchorId, filteredEdges);
    });

    // For each partition, run cycle detection
    edgesByAnchor.forEach((partitionEdges, anchorId) => {
        if (partitionEdges.length === 0) return;

        const partitionCycles = findCyclesInPartition(partitionEdges);
        cycles.push(...partitionCycles);
    });


    // De-duplicate nodes in each cycle
    cycles.forEach(cycle => {
        // Create a new array with unique node IDs while preserving order
        const uniqueNodes: string[] = [];
        cycle.nodes.forEach(nodeId => {
            if (!uniqueNodes.includes(nodeId)) {
                uniqueNodes.push(nodeId);
            }
        });
        
        // Replace the original nodes array with the de-duplicated one
        cycle.nodes = uniqueNodes;
    });

    return cycles;
}

/**
 * Finds cycles within a partition of edges with the same anchor ID.
 */
function findCyclesInPartition(edges: BindingEdge[]): { nodes: string[], edges: BindingEdge[] }[] {
    const cycles: Array<{ nodes: string[], edges: BindingEdge[] }> = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const pathMap = new Map<string, { prev: string, edge: BindingEdge }>();

    // Build adjacency list for quick lookup
    const adjacencyList = buildAdjacencyList(edges);

    // DFS function for cycle detection
    function dfs(nodeId: string): boolean {
        if (stack.has(nodeId)) {
            // Found a cycle - reconstruct it
            const cycleNodes: string[] = [];
            const cycleEdges: BindingEdge[] = [];

            let current = nodeId;
            let pathInfo = pathMap.get(current);

            while (pathInfo && pathInfo.prev !== nodeId) {
                cycleNodes.push(current);
                cycleEdges.push(pathInfo.edge);
                current = pathInfo.prev;
                pathInfo = pathMap.get(current);
            }

            if (pathInfo) {
                cycleNodes.push(current);
                cycleNodes.push(nodeId);
                cycleEdges.push(pathInfo.edge);
            }

            cycles.push({ nodes: cycleNodes, edges: cycleEdges });
            return true;
        }

        if (visited.has(nodeId)) {
            return false;
        }

        visited.add(nodeId);
        stack.add(nodeId);

        const neighbors = adjacencyList.get(nodeId) || [];
        for (const { targetNode, edge } of neighbors) {
            pathMap.set(targetNode, { prev: nodeId, edge });

            if (dfs(targetNode)) {
                return true;
            }
        }

        stack.delete(nodeId);
        return false;
    }

    // Start DFS from each node
    const allNodes = new Set<string>();
    edges.forEach(edge => {
        allNodes.add(edge.source.nodeId);
        allNodes.add(edge.target.nodeId);
    });

    allNodes.forEach(nodeId => {
        if (!visited.has(nodeId)) {
            dfs(nodeId);
        }
    });

    return cycles;
}

/**
 * Builds an adjacency list from a list of edges for faster traversal.
 */
function buildAdjacencyList(edges: BindingEdge[]): Map<string, Array<{ targetNode: string, edge: BindingEdge }>> {
    const adjacencyList = new Map<string, Array<{ targetNode: string, edge: BindingEdge }>>();

    edges.forEach(edge => {
        const sourceNode = edge.source.nodeId;
        const targetNode = edge.target.nodeId;

        if (!adjacencyList.has(sourceNode)) {
            adjacencyList.set(sourceNode, []);
        }

        adjacencyList.get(sourceNode)!.push({ targetNode, edge });
    });

    return adjacencyList;
}

/**
 * Removes direct cycle edges from the edge list.
 */
function filterOutCycleEdges(edges: BindingEdge[], cycle: { nodes: string[], edges: BindingEdge[] }): BindingEdge[] {
    const cycleEdgeSet = new Set(cycle.edges.map(edge =>
        `${edge.source.nodeId}:${edge.source.anchorId}:${edge.target.nodeId}:${edge.target.anchorId}`
    ));

    return edges.filter(edge => {
        const edgeKey = `${edge.source.nodeId}:${edge.source.anchorId}:${edge.target.nodeId}:${edge.target.anchorId}`;
        return !cycleEdgeSet.has(edgeKey);
    });
}

/**
 * Rewires node connections to use internal anchors and connect through merged node.
 */
function rewireNodeConnections(
    edges: BindingEdge[],
    node1Id: string,
    node2Id: string,
    anchorId: string,
    mergedNodeId: string,
    bindingManager: BindingManager
): void {
    // Create internal anchors for both nodes
    const component1 = bindingManager.getComponent(node1Id);
    const component2 = bindingManager.getComponent(node2Id);

    if (!component1 || !component2) {
        throw new Error(`Components not found: ${node1Id}, ${node2Id}`);
    }

    // Create _internal anchors
    createInternalAnchor(component1, anchorId);
    createInternalAnchor(component2, anchorId);

    // Redirect incoming edges to internal anchors
    redirectIncomingEdges(edges, node1Id, anchorId);
    redirectIncomingEdges(edges, node2Id, anchorId);

    // Add connections to and from merged node
    const internalAnchorId = `${anchorId}_internal`;

    // node1 internal -> merged -> node1
    edges.push({
        source: { nodeId: node1Id, anchorId: internalAnchorId },
        target: { nodeId: mergedNodeId, anchorId }
    });

    edges.push({
        source: { nodeId: mergedNodeId, anchorId },
        target: { nodeId: node1Id, anchorId }
    });

    // node2 internal -> merged -> node2
    edges.push({
        source: { nodeId: node2Id, anchorId: internalAnchorId },
        target: { nodeId: mergedNodeId, anchorId }
    });

    edges.push({
        source: { nodeId: mergedNodeId, anchorId },
        target: { nodeId: node2Id, anchorId }
    });
}

/**
 * Creates an internal anchor by cloning and modifying the original.
 */
function createInternalAnchor(component: BaseComponent, anchorId: string): void {
    const originalAnchor = component.getAnchor(anchorId);
    if (!originalAnchor) return;

    const internalAnchorId = `${anchorId}_internal`;

    // Clone the anchor
    const clonedAnchor = cloneAnchor(originalAnchor);

    // Modify the compile function to return internal signal
    const originalResult = originalAnchor.compile();
    clonedAnchor.compile = () => {
        if ('value' in originalResult) {
            const value = originalResult.value;
            // Replace signal name placeholder with component ID
            const updatedValue = value.replace(
                'VGX_SIGNAL_NAME',
                `${originalAnchor.id.componentId}`
            );
            return { value: `${updatedValue}_internal` };
        }
        return originalResult;
    };

    component.setAnchor(internalAnchorId, clonedAnchor);
}

/**
 * Redirects incoming edges to use the internal anchor instead.
 */
function redirectIncomingEdges(edges: BindingEdge[], nodeId: string, anchorId: string): void {
    edges.forEach(edge => {
        if (
            edge.target.nodeId === nodeId &&
            edge.target.anchorId === anchorId
        ) {
            edge.target.anchorId = `${anchorId}_internal`;
        }
    });
}

/**
 * Clones an anchor, preserving its component reference.
 */
function cloneAnchor(anchor: any): any {
    const { component, ...rest } = anchor;
    const clone = JSON.parse(JSON.stringify(rest));
    return { ...clone, component };
}

/**
 * Creates a deep clone of the binding graph.
 */
function cloneGraph(graph: BindingGraph): BindingGraph {
    return {
        nodes: graph.nodes.map(node => ({
            id: node.id,
            type: node.type
        })),
        edges: JSON.parse(JSON.stringify(graph.edges))
    };
} 