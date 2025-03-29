import { BindingManager } from "./BindingManager";
import { BaseComponent } from "../components/base";
import { expandEdges, extractAnchorType, isAnchorTypeCompatible } from "./cycles";
import { resolveCycleMulti } from "./cycles";
import { pruneEdges } from "./prune";

export interface BindingNode {
    id: string;
    type: string;
}

export interface AnchorId { nodeId: string; anchorId: string; };

export interface BindingEdge {
    source: AnchorId;
    target: AnchorId;
    implicit?: boolean;
}


export interface BindingGraph {
    nodes: BindingNode[];
    edges: BindingEdge[];
}


function expandConstraintsToSiblingNodes(edges: BindingEdge[], components: BaseComponent[]): BindingEdge[] {
    const expandedEdges: BindingEdge[] = [];


    // Create a map of component ID to its anchors used as sources
    const nodeToUsedAnchorsMap = new Map<string, Set<string>>();
    edges.forEach(edge => {
        if (!nodeToUsedAnchorsMap.has(edge.source.nodeId)) {
            nodeToUsedAnchorsMap.set(edge.source.nodeId, new Set());
        }
        nodeToUsedAnchorsMap.get(edge.source.nodeId)?.add(edge.source.anchorId);
    });


    // Process each component
    components.forEach(component => {

        // FOR PASSING BETWEEN SIBLING
        const usedAnchors = nodeToUsedAnchorsMap.get(component.id) || new Set();

        // Get all anchors for this component
        const componentAnchors = Array.from(component.getAnchors().values())
            .map(anchor => anchor.id.anchorId);

        // Find compatible edges for each anchor
        componentAnchors.forEach(anchorId => {
            // If anchor is not used as a source, skip it (no need to add constraints to it)
            if (!usedAnchors.has(anchorId)) return;

            // Find compatible edges from existing edges
            const compatibleEdges = edges.filter(edge => {
                const sourceAnchorType = extractAnchorType(edge.source.anchorId);
                const targetAnchorType = extractAnchorType(anchorId);
                return isAnchorTypeCompatible(sourceAnchorType, targetAnchorType) && edge.target.nodeId === component.id
            });

            // Create new edges for each compatible edge
            compatibleEdges.forEach(edge => {
                const newEdge: BindingEdge = {
                    source: edge.source,
                    target: {
                        nodeId: component.id,
                        anchorId: anchorId
                    }
                };
                expandedEdges.push(newEdge);
            });
        });



        // FOR PASSING FROM SIBLINGS TO THE DEFAULT, EVEN IF DEFAULT IS NOT A SOURCE
        // THIS IS NECESSARY TO ENSURE THAT THE DEFAULT MAY BE USED DURING NODE COMPILATION

        // For each component, check incoming edges targeting non-default anchors
        const incomingEdges = edges.filter(edge => edge.target.nodeId === component.id);

        // Create a map of configuration IDs to determine if they are default
        const configDefaultMap = new Map<string, boolean>();
        const defaultConfigId = component.configurations.find(config => config.default)?.id

        // Process each incoming edge
        incomingEdges.forEach(edge => {
            // Extract configuration ID from the target anchor
            const targetAnchorParts = edge.target.anchorId.split('_');
            if (targetAnchorParts.length < 2) return; // Skip if anchor format is unexpected

            const configId = targetAnchorParts[0];
            const channelName = targetAnchorParts.slice(1).join('_');

            // Skip if this is already targeting a default configuration
            if (configDefaultMap.get(configId)) return;

            if (!defaultConfigId) return; // Skip if no default configuration exists

            // Create a new target anchor ID using the default configuration
            const defaultAnchorId = `${defaultConfigId}_${channelName}`;

            // Check if this anchor exists in the component
            const hasDefaultAnchor = componentAnchors.includes(defaultAnchorId);
            if (!hasDefaultAnchor) return;

            // Create a duplicate edge targeting the default anchor
            const newEdge: BindingEdge = {
                source: { ...edge.source },
                target: {
                    nodeId: component.id,
                    anchorId: defaultAnchorId
                }
            };

            // Add to expanded edges if not already present
            const isDuplicate = expandedEdges.some(existingEdge =>
                existingEdge.source.nodeId === newEdge.source.nodeId &&
                existingEdge.source.anchorId === newEdge.source.anchorId &&
                existingEdge.target.nodeId === newEdge.target.nodeId &&
                existingEdge.target.anchorId === newEdge.target.anchorId
            );

            if (!isDuplicate) {
                expandedEdges.push(newEdge);
            }
        });
    });

    return [...edges, ...expandedEdges];
}
export class GraphManager {
    private bindingManager: BindingManager;


    constructor(getBindingManager: () => BindingManager) {
        this.bindingManager = getBindingManager();
    }

    public buildCompilationGraph(fromComponentId: string): BindingGraph {
        // specific binding graph for this tree
        let bindingGraph = this.generateBindingGraph(fromComponentId);
        console.log('bindingGraph', JSON.parse(JSON.stringify(bindingGraph)))

        // expand any _all anchors to individual anchors
        const expandedEdges = expandEdges(bindingGraph.edges);

        console.log('expandedEdges', expandedEdges)
        const prunedEdges = pruneEdges(bindingGraph.nodes, expandedEdges, fromComponentId);

        console.log('expandedEdgesprunedEdges', prunedEdges)

        const siblingExpandedEdges = expandConstraintsToSiblingNodes(prunedEdges, Array.from(this.bindingManager.getComponents().values()));

        console.log('comparing siblingExpandedEdges', siblingExpandedEdges, prunedEdges)
        bindingGraph.edges = siblingExpandedEdges;

        const elaboratedGraph = resolveCycleMulti(bindingGraph, this.bindingManager);

        console.log('elaboratedGraph', elaboratedGraph)

        return elaboratedGraph;
    }

    public generateBindingGraph(startComponentId: string): BindingGraph {
        let nodes: BindingNode[] = [];
        let edges: BindingEdge[] = [];  
        const visited = new Set<string>();

        const addNode = (component: BaseComponent) => {
            if (nodes.find(node => node.id === component.id)) {
                return;
            } else {
                nodes.push({
                    id: component.id,
                    type: component.constructor.name,
                });
            }
        };

        const traverse = (componentId: string) => {
            if (visited.has(componentId)) return;
            visited.add(componentId);

            const component = this.bindingManager.getComponent(componentId);
            if (!component) return;

            addNode(component);

            // Get all bindings where this component is either source or target to catch nodes
            // that are not accdssible through the root node
            const allBindings = this.bindingManager.getBindingsForComponent(componentId, 'both');

            // Process source bindings
            allBindings.forEach(binding => {
                const { sourceId, targetId, sourceAnchor, targetAnchor } = binding;
                [sourceId, targetId].forEach(id => {
                    const comp = this.bindingManager.getComponent(id);
                    if (comp) addNode(comp);
                });

                edges.push({
                    source: { nodeId: sourceId, anchorId: sourceAnchor },
                    target: { nodeId: targetId, anchorId: targetAnchor }
                });


                // traverse both source and target such that we catch nodes that are not accessible through the root node
                traverse(sourceId);
                traverse(targetId);
            });
        };

        traverse(startComponentId);
        // De-duplicate nodes by creating a map with node IDs as keys
        const uniqueNodesMap = new Map();
        nodes.forEach(node => {
            uniqueNodesMap.set(node.id, node);
        });

        // Convert map back to array
        const uniqueNodes = Array.from(uniqueNodesMap.values());

        // De-duplicate edges by creating a unique key for each edge
        const uniqueEdgesMap = new Map();
        edges.forEach(edge => {
            const edgeKey = `${edge.source.nodeId}:${edge.source.anchorId}->${edge.target.nodeId}:${edge.target.anchorId}`;
            uniqueEdgesMap.set(edgeKey, edge);
        });

        // Convert map back to array
        const uniqueEdges = Array.from(uniqueEdgesMap.values());

        // Replace the original arrays with de-duplicated ones
        nodes = uniqueNodes;
        edges = uniqueEdges;
        return { nodes, edges };
    }


}
