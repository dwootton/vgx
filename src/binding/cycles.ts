import { AnchorId, BindingEdge, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager } from "./BindingManager";
import { BaseComponent } from "../components/base";
import { createMergedComponentForChannel } from "./mergedComponent";
// import { expandEdges } from "./SpecCompiler";
import { getGenericAnchorTypeFromId, } from "../utils/anchorGeneration/rectAnchors";
import { AnchorType } from "../types/anchors";

export function expandEdges(edges: BindingEdge[]): BindingEdge[] {
    const expanded = edges.flatMap(edge => {
        const sourceComponent = BindingManager.getInstance().getComponent(edge.source.nodeId);
        if (!sourceComponent) {
            throw new Error(`Source component ${edge.source.nodeId} not found`);
        }
        const targetComponent = BindingManager.getInstance().getComponent(edge.target.nodeId);
        if (!targetComponent) {
            throw new Error(`Target component ${edge.target.nodeId} not found`);
        }


        const allEdges = expandGroupAnchors(edge, sourceComponent, targetComponent)
        return allEdges
    })

    return expanded.filter(e => e.source.anchorId !== '_all' || e.target.anchorId !== '_all');;
}


function expandGroupAnchors(edge: BindingEdge, source: BaseComponent, target: BaseComponent): BindingEdge[] {
    const sourceAnchors = expandAnchorsFromEdge(edge.source.anchorId, source);
    const targetAnchors = expandAnchorsFromEdge(edge.target.anchorId, target);


    function expandAnchorsFromEdge(anchorId: string, component: BaseComponent): string[] {
        const allAnchors = [...component.getAnchors().values()].map(a => a.id.anchorId)

        if (anchorId === '_all') {


            const defaultConfigId = component.configurations.find((config: any) => config.default).id;
           
            if (!defaultConfigId) {
                return allAnchors
            }

            return allAnchors.filter(a => a.includes(defaultConfigId))
        }

        // If anchorId matches any configuration id
        if (component.configurations.find((config: any) => config.id === anchorId)) {
            // Return all anchors that include this configuration id
            return allAnchors.filter(a => a.includes(anchorId));
        }


        return [anchorId]
    }


    const expandedEdges = sourceAnchors.flatMap(sourceAnchor =>
        targetAnchors
            .filter(targetAnchor => isAnchorTypeCompatible(sourceAnchor, targetAnchor))
            .map(targetAnchor => ({
                source: { nodeId: edge.source.nodeId, anchorId: sourceAnchor },
                target: { nodeId: edge.target.nodeId, anchorId: targetAnchor }
            }))
    );


    return expandedEdges;
}



// // Interactor schema fn 
// function expandGroupAnchors(edge: BindingEdge, source: BaseComponent, target: BaseComponent): BindingEdge[] {

//     return expandGroupAnchors(edge, source, target);


//     // Helper function to get anchors based on the anchorId that was bound (including _all)
//     const getAnchors = (component: BaseComponent, anchorId: string) => {
//         if (anchorId === '_all') {
//             if (Object.keys(component.configurations).find(confidId => component.configurations[confidId].default)) {

//                 const defaultConfig = Object.keys(component.configurations).find(confidId => component.configurations[confidId].default)

//                 const allAnchors = [...component.getAnchors().values()].map(a => a.id.anchorId)
//                 if (!defaultConfig) {

//                     return allAnchors
//                 }
//                 // console.log('returin all anchorsPitsod')
//                 const filteredAnchors = allAnchors.filter(a => a.includes(defaultConfig))
//                 if (filteredAnchors.length == 0) {
//                     return allAnchors
//                 }



//                 return filteredAnchors;
//             } else {
//                 return [...component.getAnchors().values()].map(a => a.id.anchorId);
//             }
//         }



//         if (component.configurations[anchorId]) {

//             const componentAnchors = [...component.getAnchors().values()]
//             const filteredAnchors = componentAnchors.filter(a => a.id.anchorId.includes(anchorId))
//             const mappedAnchors = filteredAnchors.map(a => a.id.anchorId)
//             return mappedAnchors
//         }

//         // Return the default config if nothing else was specified, TODO, in the future return the ideal schema
//         const defaultConfig = Object.keys(component.configurations).find(configId =>
//             component.configurations[configId].default);

//         if (defaultConfig) {
//             const configAnchors = [...component.getAnchors().values()]
//                 .filter(a => a.id.anchorId.includes(defaultConfig) && a.id.anchorId == anchorId)

//                 .map(a => a.id.anchorId);

//             // If we found configuration-based anchors, return those
//             if (configAnchors.length > 0) {
//                 return configAnchors;
//             }
//         }

//         // If we didn't find any other 
//         const baseAnchorId = anchorId
//         try {
//             //TODO this is a hack to remove them, but this was giving me a lot of errors with begin_x, begin_y, etc. 
//             console.log('baseAnchorId', baseAnchorId, component.getAnchor(baseAnchorId))
//             component.getAnchor(baseAnchorId);
//             return [];
//         } catch (error) {
//             //throw new Error(`Anchor ${baseAnchorId} not found for component ${component.id}`);
//             // Anchor doesn't exist, continue with empty array
//             return [];
//         }

//     };

//     function checkAnchorTypeCompatibility(sourceAnchorId: string, targetAnchorId: string) {
//         const sourceAnchorType = extractAnchorType(sourceAnchorId);
//         const targetAnchorType = extractAnchorType(targetAnchorId);

//         if (sourceAnchorType == AnchorType.OTHER || targetAnchorType == AnchorType.OTHER) {
//             return true;
//         }
//         return isAnchorTypeCompatible(sourceAnchorId, targetAnchorId);
//     }

//     const sourceAnchors = getAnchors(source, edge.source.anchorId)//.filter(sourceAnchorId => checkAnchorTypeCompatibility(sourceAnchorId, edge.source.anchorId));
//     let targetAnchors = getAnchors(target, edge.target.anchorId)//.filter(targetAnchorId => checkAnchorTypeCompatibility(targetAnchorId, edge.target.anchorId));


//     const expandedEdges = sourceAnchors.flatMap(sourceAnchor =>
//         targetAnchors
//             .filter(targetAnchor => isAnchorTypeCompatible(sourceAnchor, targetAnchor))
//             .map(targetAnchor => ({
//                 source: { nodeId: edge.source.nodeId, anchorId: sourceAnchor },
//                 target: { nodeId: edge.target.nodeId, anchorId: targetAnchor }
//             }))
//     );
//     console.log("FULLYEXPANDEDEDGESOLD", expandedEdges)
//     return expandedEdges;
// }

export function extractAnchorType(anchorId: string): AnchorType {
    if (anchorId === '_all') return AnchorType.OTHER;

    if (anchorId.includes('markName')) {
        return AnchorType.MARK_NAME;
    }

    if (anchorId.includes('_internal')) {

        return extractAnchorType(anchorId.split('_internal')[0])
    }

    // Handle special cases like x1, x2, y1, y2
    if (anchorId === 'x1' || anchorId === 'x2') {
        return AnchorType.X;
    }
    if (anchorId === 'y1' || anchorId === 'y2') {
        return AnchorType.Y;
    }

    // If it's a simple channel name that matches an AnchorType
    const anchorTypeValues = Object.values(AnchorType) as string[];
    if (anchorTypeValues.includes(anchorId)) {
        return anchorId as AnchorType;
    }



    // For complex IDs like 'point_x', 'span_pla_x', extract the last part
    const parts = anchorId.split('_');
    const lastPart = parts[parts.length - 1];

    // Check if the last part is a valid AnchorType
    if (anchorTypeValues.includes(lastPart)) {
        return lastPart as AnchorType;
    }

    return null;
    // throw new Error(`Invalid anchor type: ${anchorId}`);

}

export function isAnchorTypeCompatible(sourceAnchorId: string, targetAnchorId: string) {

    const sourceAnchorType = extractAnchorType(sourceAnchorId);
    const targetAnchorType = extractAnchorType(targetAnchorId);

    if (!sourceAnchorType || !targetAnchorType) {
        return false;
    }
    return getGenericAnchorTypeFromId(sourceAnchorType) == getGenericAnchorTypeFromId(targetAnchorType);
}

/**
 * Rewires connections for multiple nodes to go through a merged component
 */
function rewireMultiNodeConnections(
    cycleEdges: BindingEdge[],
    cycleNodeIds: string[],
    allEdges: BindingEdge[],
    mergedNodeId: string,
    bindingManager: BindingManager
): BindingEdge[] {
    const edges = [...allEdges];

    // Create internal anchors for all nodes in the cycle
    cycleNodeIds.forEach(nodeId => {
        const component = bindingManager.getComponent(nodeId);
        if (!component) {
            console.warn(`Component not found: ${nodeId}`);
            return;
        }

        //find the anchorIds for this node via cycleEdges
        let allEdgeAnchorIdsInCycle = cycleEdges.filter(edge => edge.source.nodeId === nodeId || edge.target.nodeId === nodeId).map(edge => edge.source.anchorId === edge.target.anchorId ? edge.source.anchorId : edge.target.anchorId)
        allEdgeAnchorIdsInCycle = allEdgeAnchorIdsInCycle.map(id => id.split('_internal')[0])

        // Get the anchor for this component that uses this channel
        const anchorId = component.getAnchors().find(anchor => allEdgeAnchorIdsInCycle.includes(anchor.id.anchorId))?.id.anchorId as string;


        const channel = extractAnchorType(anchorId)

        if (!anchorId || !channel) {
            console.warn(`No anchor found for channel in component ${nodeId}`);
            return;
        }

        // Create internal anchor
        createInternalAnchor(component, anchorId);

        // Redirect incoming edges to internal anchors
        redirectIncomingEdges(edges, nodeId, anchorId);

        const internalAnchorId = `${anchorId}_internal`;


        // Add connections to and from merged node
        // Component internal -> merged
        edges.push({
            source: { nodeId, anchorId: internalAnchorId },
            target: { nodeId: mergedNodeId, anchorId: channel }
        });

        // Merged -> component original
        edges.push({
            source: { nodeId: mergedNodeId, anchorId: `${channel}` },
            target: { nodeId, anchorId }
        });

    });

    // Remove the original cycle edges
    const filteredEdges = edges.filter(edge => {
        // Check if this edge is part of the original cycle
        return !cycleEdges.some(cycleEdge =>
            cycleEdge.source.nodeId === edge.source.nodeId &&
            cycleEdge.source.anchorId === edge.source.anchorId &&
            cycleEdge.target.nodeId === edge.target.nodeId &&
            cycleEdge.target.anchorId === edge.target.anchorId
        );
    });

    return filteredEdges;
}

/**
 * Resolves a single cycle by creating a merged node and rewiring connections.
 */
export function resolveCycleMulti(
    graph: BindingGraph,
    bindingManager: BindingManager
): BindingGraph {
    let processedGraph = cloneGraph(graph);

    let cycles = detectCyclesByChannel(processedGraph.edges);
    cycles = cycles.filter(cycle => !(cycle.nodes.length === 1));


    cycles.forEach(cycle => {
        const { nodes, edges } = cycle;

        // Get the channel this cycle is based on
        const cycleChannel = extractAnchorType(edges[0].source.anchorId)
        if (!cycleChannel) {
            console.warn("Could not determine consistent channel for cycle", cycle);
            return;
        }

        // Create merged component for this cycle
        const mergedComponent = createMergedComponentForChannel(
            nodes,
            cycleChannel,
            bindingManager
        );


        // Add merged component to binding manager
        bindingManager.addComponent(mergedComponent);

        // Add merged node to graph
        processedGraph.nodes.push({
            id: mergedComponent.id,
            type: 'merged'
        });

        //now for each edge, lets now modify it to use the merged component

        // Rewire connections for all nodes in the cycle
        const rewiredEdges = rewireMultiNodeConnections(
            edges,
            nodes,
            processedGraph.edges,
            mergedComponent.id,
            bindingManager
        );

        // Remove direct cycle edges
        processedGraph.edges = filterOutCycleEdges(rewiredEdges, cycle);
    });


    const hasCycle = detectCycles(processedGraph)
    if(hasCycle.length > 0){
        console.log('STILLhasCycle',hasCycle)
    }


    return processedGraph;
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
        const sourceAnchor = extractAnchorType(edge.source.anchorId);
        if (!sourceAnchor) return;
        anchorIds.add(sourceAnchor);
    });

    // Partition edges by anchor ID
    anchorIds.forEach(anchorId => {
        const filteredEdges = edges.filter(edge =>
            (extractAnchorType(edge.source.anchorId) === anchorId || extractAnchorType(edge.target.anchorId) === anchorId) && isAnchorTypeCompatible(edge.source.anchorId, edge.target.anchorId)
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
    // TODO double cycles don't work....
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

// /**
//  * Rewires node connections to use internal anchors and connect through merged node.
//  */
// function rewireNodeConnections(
//     edges: BindingEdge[],
//     node1Id: string,
//     node2Id: string,
//     node1AnchorId: string,
//     node2AnchorId: string,
//     mergedNodeId: string,
//     bindingManager: BindingManager
// ): void {
//     // Create internal anchors for both nodes
//     const component1 = bindingManager.getComponent(node1Id);
//     const component2 = bindingManager.getComponent(node2Id);

//     if (!component1 || !component2) {
//         throw new Error(`Components not found: ${node1Id}, ${node2Id}`);
//     }


//     //TODO: need to not just cycle cycles[0], but instead get the anchorIOd from thedges and then use thart. 
//     // Create _internal anchors
//     createInternalAnchor(component1, node1AnchorId);
//     createInternalAnchor(component2, node2AnchorId);

//     // Redirect incoming edges to internal anchors
//     redirectIncomingEdges(edges, node1Id, node1AnchorId);
//     redirectIncomingEdges(edges, node2Id, node2AnchorId);

//     const channel = extractChannel(node1AnchorId);
//     // get the channel and use that

//     // Add connections to and from merged node

//     const internalNode1AnchorId = `${node1Id}_internal_${channel}`;
//     const internalNode2AnchorId = `${node2Id}_internal_${channel}`;


//     // node1 internal -> merged -> node1
//     edges.push({
//         source: { nodeId: node1Id, anchorId: internalNode1AnchorId },
//         target: { nodeId: mergedNodeId, anchorId: internalAnchorId }
//     });

//     edges.push({
//         source: { nodeId: mergedNodeId, anchorId: internalNode1AnchorId },
//         target: { nodeId: node1Id, anchorId: internalAnchorId }
//     });

//     // node2 internal -> merged -> node2
//     edges.push({
//         source: { nodeId: node2Id, anchorId: internalNode2AnchorId },
//         target: { nodeId: mergedNodeId, anchorId: internalAnchorId }
//     });

//     edges.push({
//         source: { nodeId: mergedNodeId, anchorId: internalNode2AnchorId },
//         target: { nodeId: node2Id, anchorId: internalAnchorId }
//     });
// }

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
        edges: JSON.parse(JSON.stringify(graph.edges)),
    };
}

/**
 * Detects cycles in a binding graph using DFS.
 * Returns array of cycles, each containing nodes and edges.
 */
function detectCycles(graph: BindingGraph): Array<{ nodes: string[], edges: BindingEdge[] }> {
    const { nodes, edges } = graph;
    const cycles: Array<{ nodes: string[], edges: BindingEdge[] }> = [];

    // Track visited nodes during DFS
    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];
    const pathEdges: BindingEdge[] = [];

    // Helper function for DFS
    function dfs(nodeId: string, prev: string | null = null) {
        if (stack.has(nodeId)) {
            // Cycle detected - extract nodes and edges
            const cycleStart = path.indexOf(nodeId);
            const cycleNodes = path.slice(cycleStart);
            const cycleEdges = pathEdges.slice(cycleStart);

            // Add the closing edge if it exists
            if (prev) {
                const closingEdge = edges.find(e =>
                    e.source.nodeId === prev && e.target.nodeId === nodeId
                );
                if (closingEdge) {
                    cycleEdges.push(closingEdge);
                }
            }

            cycles.push({ nodes: cycleNodes, edges: cycleEdges });
            return;
        }

        if (visited.has(nodeId)) return;

        visited.add(nodeId);
        stack.add(nodeId);
        path.push(nodeId);

        // Find all outgoing edges
        const outgoingEdges = edges.filter(e => e.source.nodeId === nodeId);

        for (const edge of outgoingEdges) {
            pathEdges.push(edge);
            dfs(edge.target.nodeId, nodeId);

            // Backtrack
            if (pathEdges.length > 0) {
                pathEdges.pop();
            }
        }

        path.pop();
        stack.delete(nodeId);
    }

    // Run DFS from each node
    for (const node of nodes) {
        if (!visited.has(node.id)) {
            dfs(node.id);
        }
    }

    return cycles;
} 