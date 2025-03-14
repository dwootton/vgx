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
        const nodes: BindingNode[] = [];
        new Map<string, BindingNode>();
        const edges: BindingEdge[] = [];
        const visited = new Set<string>();

        const addNode = (component: BaseComponent) => {
            console.log('adding node', component.id,nodes)
            if(nodes.find(node => node.id === component.id)) {
                console.log('node already exists', component.id)
                return;
            } else {
                console.log('setting node', component.id,nodes)
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

            this.bindingManager.getBindingsForComponent(componentId, 'source').forEach(binding => {
                const { sourceId, targetId, sourceAnchor, targetAnchor } = binding;

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

        console.log('generated binding graph', JSON.parse(JSON.stringify(nodes)), JSON.parse(JSON.stringify(edges)))
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
