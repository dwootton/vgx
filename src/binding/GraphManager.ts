import { BindingManager } from "./BindingManager";
import { BaseComponent } from "../components/base";

export interface BindingNode {
    id: string;
    type: string;
}

export interface BindingEdge {
    source: { nodeId: string; anchorId: string; };
    target: { nodeId: string; anchorId: string; };
}


export interface BindingGraph {
    nodes: BindingNode[];
    edges: BindingEdge[];
}

export class GraphManager {
    private bindingManager: BindingManager;
    // superNodes are nodes whose data must be merged due to cycle in the dataflow graph
    // we maintain a map of original node ID to superNode ID, and then during compilation
    // the compilation context will refer to the superNode ID. 
    private superNodes: Map<string, string> = new Map();


    constructor(getBindingManager: () => BindingManager) {
        this.bindingManager = getBindingManager();
    }

    public generateBindingGraph(startComponentId: string): BindingGraph {
        let nodes: BindingNode[] = [];
        let edges: BindingEdge[] = [];
        const visited = new Set<string>();

        const addNode = (component: BaseComponent) => {
            if(nodes.find(node => node.id === component.id)) {
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

            // Get all bindings where this component is either source or target
            const allBindings = this.bindingManager.getBindingsForComponent(componentId, 'both');
            
            console.log('allBindings', allBindings)
            // Process source bindings
            allBindings.forEach(binding => {
                const { sourceId, targetId, sourceAnchor, targetAnchor } = binding;
                console.log('allBindings', binding, sourceId, targetId);
                [sourceId, targetId].forEach(id => {
                    const comp = this.bindingManager.getComponent(id);
                    if (comp) addNode(comp);
                });

                edges.push({
                    source: { nodeId: sourceId, anchorId: sourceAnchor },
                    target: { nodeId: targetId, anchorId: targetAnchor }
                });
                
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
        console.log('uniqueNodes', uniqueNodes)
        console.log('uniqueEdges', uniqueEdges)
        return { nodes, edges };
    }

    
    public setSuperNodeMap(superNodeMap: Map<string, string>): void {
        this.superNodes = superNodeMap;
    }

    public getSuperNodeMap(): Map<string, string> {
        return this.superNodes;
    }

    public printGraph(startComponentId: string): void {
        const { nodes, edges } = this.generateBindingGraph(startComponentId);

        nodes.forEach(node =>
            console.log(`  ${node.id} (${node.type})\n}`)
        );

        console.log('\nEdges:');
        edges.forEach(edge =>
            console.log(`  ${edge.source.nodeId}.${edge.source.anchorId} -> ${edge.target.nodeId}.${edge.target.anchorId}`)
        );
    }
}
