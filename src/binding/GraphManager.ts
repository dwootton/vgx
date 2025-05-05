import { BaseComponent } from '../components/base';
import { PortType } from '../types/portTypes';
import { BindingManager, BindingEdge, PortReference } from './BindingManager';
import { MiscPortType } from '../types/portTypes';
import { isPortTypeCompatible } from './compatabilityUtils';

export interface Node {
    id: string;
    component: BaseComponent;
}

export interface BindingGraph {
    nodes: Node[];
    edges: BindingEdge[];
}

export class GraphManager {
    private getBindingManager: () => BindingManager;

    constructor(getBindingManager: () => BindingManager) {
        this.getBindingManager = getBindingManager;
    }

    public generateBindingGraph(rootComponent: BaseComponent): BindingGraph {
        const visited = new Set<string>();
        const nodes: Node[] = [];
        const edges: BindingEdge[] = [];
        const processedEdges = new Set<string>();

        const processComponent = (component: BaseComponent) => {
            const componentId = component.getId();
            if (visited.has(componentId)) return;

            visited.add(componentId);
            nodes.push({
                id: componentId,
                component
            });

            const bindingManager = this.getBindingManager();

            const bindings = bindingManager.getBindingsForComponent(componentId);
            for (const binding of bindings) {
                const edgeKey = `${binding.source.componentId}:${binding.source.portGroup}:${binding.source.portType}:${binding.target.componentId}:${binding.target.portGroup}:${binding.target.portType}`;
                if (processedEdges.has(edgeKey)) continue;

                processedEdges.add(edgeKey);
                edges.push(binding);
               

                // Process connected components
                if (binding.source.componentId === componentId) {
                    const targetComponent = this.getBindingManager().getComponent(binding.target.componentId);
                    if (targetComponent) {
                        processComponent(targetComponent);
                    }
                } else {
                    const sourceComponent = this.getBindingManager().getComponent(binding.source.componentId);
                    if (sourceComponent) {
                        processComponent(sourceComponent);
                    }
                }
            }
        };

        processComponent(rootComponent);
        return { nodes, edges };
    }

    public expandEdges(graph: BindingGraph): BindingEdge[] {
        if (!graph || !graph.nodes || !graph.edges) {
            console.error('Invalid graph structure:', graph);
            return [];
        }

        const processedEdges = new Set<string>();
        const expandedEdges: BindingEdge[] = [];

        try {
            for(const edge of graph.edges) {
                if (!edge || !edge.source || !edge.target) {
                    console.error('Invalid edge structure:', edge);
                    continue;
                }

                const sourceComponent = graph.nodes.find(n => n.id === edge.source.componentId)?.component;
                const targetComponent = graph.nodes.find(n => n.id === edge.target.componentId)?.component;

                if (!sourceComponent || !targetComponent) {
                    console.error('Missing component:', {
                        sourceId: edge.source.componentId,
                        targetId: edge.target.componentId
                    });
                    continue;
                }

                if (!edge.source.portGroup || !edge.target.portGroup) {
                    console.error('Missing portGroup in edge:', edge);
                    continue;
                }

                // If edge is to all ports, expand to all ports, else just use the provided port
                let sourcePorts: PortReference[] = [];
                let targetPorts: PortReference[] = [];

                if (edge.source.portType === MiscPortType.ALL) {
                    sourcePorts = sourceComponent.getPortReferencesForGroup(edge.source.portGroup);
                } else {
                    sourcePorts = sourceComponent.getPortReferencesForGroup(edge.source.portGroup).filter(p => p.portType === edge.source.portType);
                }

                if (edge.target.portType === MiscPortType.ALL) {
                    targetPorts = targetComponent.getPortReferencesForGroup(edge.target.portGroup);
                } else {
                    targetPorts = targetComponent.getPortReferencesForGroup(edge.target.portGroup).filter(p => p.portType === edge.target.portType);
                }


                if (!Array.isArray(sourcePorts) || !Array.isArray(targetPorts)) {
                    console.error('Invalid ports returned:', {
                        sourcePorts,
                        targetPorts,
                        sourcePortGroup: edge.source.portGroup,
                        targetPortGroup: edge.target.portGroup
                    });
                    continue;
                }

                for (const sourcePort of sourcePorts) {
                    if (!sourcePort || !sourcePort.portType) continue;
                    
                    for (const targetPort of targetPorts) {
                        if (!targetPort || !targetPort.portType) continue;

                        // If port types match, add the edge. This should be turned to "compatability checks"
                        if (isPortTypeCompatible(sourcePort.portType, targetPort.portType) ) {
                            const edgeKey = `${edge.source.componentId}:${edge.source.portGroup}:${sourcePort.portType}:${edge.target.componentId}:${edge.target.portGroup}:${targetPort.portType}`;
                            if (processedEdges.has(edgeKey)) {
                                continue;
                            }

                            processedEdges.add(edgeKey);
                            const newEdge = new BindingEdge({
                                componentId: edge.source.componentId,
                                portType: sourcePort.portType,
                                portGroup: edge.source.portGroup,
                                isInternal: false
                            }, {
                                componentId: edge.target.componentId,
                                portType: targetPort.portType,
                                portGroup: edge.target.portGroup,
                                isInternal: false
                            });
                            expandedEdges.push(newEdge);
                                
                           
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in expandEdges:', error);
            return [];
        }

        return expandedEdges;
    }
} 