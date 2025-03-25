import { BindingManager } from "./BindingManager";
import { BaseComponent } from "../components/base";
import { expandEdges } from "./cycles";
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

export class GraphManager {
    private bindingManager: BindingManager;


    constructor(getBindingManager: () => BindingManager) {
        this.bindingManager = getBindingManager();
    }

    public buildCompilationGraph(fromComponentId: string): BindingGraph {
        // specific binding graph for this tree
        let bindingGraph = this.generateBindingGraph(fromComponentId);

        console.log('BINDING GRAPH', JSON.parse(JSON.stringify(bindingGraph)), this.bindingManager.getBindings())
        // expand any _all anchors to individual anchors
        const expandedEdges = expandEdges(bindingGraph.edges);

        const prunedEdges = pruneEdges(bindingGraph.nodes, expandedEdges, fromComponentId);
       
        bindingGraph.edges = prunedEdges;
   
        const elaboratedGraph = resolveCycleMulti(bindingGraph, this.bindingManager);
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
