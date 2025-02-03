import { BaseComponent } from "components/base";
import { AnchorGroupSchema, AnchorProxy, AnchorType } from "types/anchors";
import { Field } from "vega-lite/build/src/channeldef";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext, deduplicateById, groupEdgesByChannel, resolveChannelValue, validateComponent, removeUndefinedInSpec ,logComponentInfo, detectAndMergeSuperNodes} from "./binding";
import {getProxyAnchor,expandGroupAnchors} from '../utils/anchorProxy';
import { VariableParameter } from "vega-lite/build/src/parameter";
import {TopLevelSelectionParameter} from "vega-lite/build/src/selection"

type Parameter = VariableParameter | TopLevelSelectionParameter


interface BindingNode {
    id: string;
    type: string;
}

export interface BindingEdge {
    source: { nodeId: string; anchorId: string; };
    target: { nodeId: string; anchorId: string; };
}

interface Binding {
    sourceId: string;
    targetId: string;
    sourceAnchor: string;
    targetAnchor: string;
}

interface BindingGraph {
    nodes: Map<string, BindingNode>;
    edges: BindingEdge[];
}

export interface VirtualBindingEdge {
    channel: string;
    value: any;
    source: 'context' | 'baseContext' | 'generated';
}


export class BindingManager {
    private static instance: BindingManager;

    private graphManager: GraphManager;
    private specCompiler: SpecCompiler;
    private components: Map<string, BaseComponent> = new Map();
    private virtualBindings: Map<string, VirtualBindingEdge> = new Map();
    private bindings: Binding[] = [];



    public getComponents(): Map<string, BaseComponent> {
        return this.components;
    }

    public getComponent(id: string): BaseComponent | undefined {
        return this.components.get(id);
    }

    public compile(fromComponentId: string): TopLevelSpec {
        return this.specCompiler.compile(fromComponentId);
    }

   
    private constructor() {
        // Initialize dependencies lazily
        this.graphManager = new GraphManager( ()=>this);
        this.specCompiler = new SpecCompiler(this.graphManager, ()=>this);
    }

    public static getInstance(): BindingManager {
        if (!BindingManager.instance) {
            BindingManager.instance = new BindingManager();
        }
        return BindingManager.instance;
    }

    public addComponent(component: BaseComponent): void {
        this.components.set(component.id, component);
    }

    public addVirtualBinding(channel: string, virtualBinding: VirtualBindingEdge): void {
        this.virtualBindings.set(channel, virtualBinding);
    }

    public addBinding(sourceId: string, targetId: string, sourceAnchor: string, targetAnchor: string): void {
        // Add the original binding
        this.bindings.push({ sourceId, targetId, sourceAnchor, targetAnchor });
                
    };
       
    public getBindings(): Binding[] {
        return this.bindings;
    }
    

    public getBindingsForComponent(componentId: string): Binding[] {
        return this.bindings.filter(binding =>
            binding.sourceId === componentId || binding.targetId === componentId
        );
    }
    public getTargetBindingsForComponent(componentId: string): Binding[] {
        return this.bindings.filter(binding =>
            binding.targetId === componentId
        );
    }
    public getSourceBindingsForComponent(componentId: string): Binding[] {
        return this.bindings.filter(binding =>
            binding.sourceId === componentId
        );
    }

    public getVirtualBindings(): Map<string, VirtualBindingEdge> {
        return this.virtualBindings;
    }
}


export class GraphManager {
    constructor(
        private getBindingManager: () => BindingManager // Getter for BindingManager
    ) {}

    public generateBindingGraph(startComponentId: string): BindingGraph {
        const nodes = new Map<string, BindingNode>();
        const edges: BindingEdge[] = [];
        const visited = new Set<string>();
        const bindingManager = this.getBindingManager(); // Access BindingManager when needed
        

        const addNode = (component: BaseComponent) => {
            if (!nodes.has(component.id)) {
                nodes.set(component.id, {
                    id: component.id,
                    type: component.constructor.name,
                });
            }
        };

        const traverse = (componentId: string) => {
            if (visited.has(componentId)) return;
            visited.add(componentId);

            const component = bindingManager.getComponent(componentId);
            if (!component) return;

            addNode(component);

            bindingManager.getSourceBindingsForComponent(componentId).forEach(binding => {
                const { sourceId, targetId, sourceAnchor, targetAnchor } = binding;

                [sourceId, targetId].forEach(id => {
                    const comp = bindingManager.getComponent(id);
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
        return { nodes, edges };
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


export class SpecCompiler {
    constructor(
        private graphManager: GraphManager,
        private getBindingManager: () => BindingManager // Getter for BindingManager
    ) {}

    public compile(fromComponentId: string): TopLevelSpec {

        const rootComponent = this.getBindingManager().getComponent(fromComponentId);
        if (!rootComponent) {
            throw new Error(`Component "${fromComponentId}" not found.`);
        }
        console.log('rootComponent',rootComponent)

        // specific binding graph for this tree
        let bindingGraph = this.graphManager.generateBindingGraph(rootComponent.id);
       
        console.log('bindingGraph',bindingGraph)
        // Compile the updated graph
        const compiledSpecs = this.compileBindingGraph(bindingGraph);

        //const compiledSpecs = this.compileBindingGraph(bindingGraph);
        const mergedSpec = mergeSpecs(compiledSpecs,  rootComponent.id);

        return removeUndefinedInSpec(mergedSpec);
    }
    

    private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        const { nodes, edges } = bindingGraph;
        const compiledComponents: Partial<UnitSpec<Field>>[] = [];

        for (const node of nodes.values()) {
            console.log('node',node)
            const compiledNode = this.compileNode(node, edges);
            compiledComponents.push(compiledNode);
        }

        return compiledComponents;
    }

    private compileNode(node: BindingNode, graphEdges: BindingEdge[]): Partial<UnitSpec<Field>> {

        const filteredEdges = graphEdges.filter(edge => edge.target.nodeId === node.id )
        const edges = this.prepareEdges(filteredEdges)


        const superNodeMap : Map<string, string>= detectAndMergeSuperNodes(graphEdges);

        let compilationContext = {nodeId: superNodeMap.get(node.id) || node.id};

        compilationContext = this.buildCompilationContext(edges,compilationContext);
        
        const compiledSpec = this.compileComponentWithContext(node.id, compilationContext);
        console.log('compiledSpec',compiledSpec, node.id)
        return compiledSpec;
    }

   
    private prepareEdges(graphEdges: BindingEdge[]): AnchorProxy[] {
        const anchorProxies = graphEdges
            .map(edge => getProxyAnchor(edge, this.getBindingManager().getComponent(edge.source.nodeId)));

        const expandedEdges = anchorProxies.flatMap(anchorProxy =>
            expandGroupAnchors(anchorProxy, anchorProxy.component)
        );

        return deduplicateById(expandedEdges);
    }

    /**
     * Compilation context is the object that is provided to each component during 
     * its compile process. It is generated by grouping each incoming edge by its
     * type, compiling the edge's value,then resolving the provided information. 
     * 
     * @param edges - the incoming anchors that provide information to this node
     * @returns 
     */
    private buildCompilationContext(edges: AnchorProxy[], context: compilationContext): compilationContext {
        const groupedEdges = groupEdgesByChannel(edges);
        
        // to log component name
        logComponentInfo(groupedEdges as Map<string, AnchorProxy[]>, this.getBindingManager());

        this.getBindingManager().getVirtualBindings().forEach((virtualBinding, channel) => {
            groupedEdges.get(channel)?.push(virtualBinding);
        });

        for (const [channel, channelEdges] of groupedEdges) {
            // Get the component for this channel if it exists
            context[channel] = resolveChannelValue(channelEdges,context.nodeId);
        }

        // determine if this is a super node, and then add it to the context

        return context;
    }

    private compileComponentWithContext(nodeId: string, context: compilationContext): Partial<UnitSpec<Field>> {
        const component = this.getBindingManager().getComponent(nodeId);
        if (!component) {
            throw new Error(`Component "${nodeId}" not found.`);
        }
        validateComponent(component, nodeId);
        return component.compileComponent(context);
    }

    
}

function  mergeSpecs(specs: Partial<UnitSpec<Field>>[], rootComponentId: string): TopLevelSpec {
    // Helper to check if spec has layer/mark
    const hasLayerOrMark = (spec: any) => {
        return spec.layer || spec.mark;
    };


    // First merge specs, handling layers
    const mergedSpec = specs.reduce((merged: any, spec) => {
        // If either has layer/mark, create layer spec
        if (hasLayerOrMark(merged) && hasLayerOrMark(spec)) {
            return {
                layer: [
                    merged,
                    spec
                ]
            };
        }

        // Otherwise merge normally
        return {
            ...merged,
            ...spec,
            // Concatenate params if they exist
            params: [
                ...(merged.params || []),
                ...(spec.params || [])
            ]
        };
    }, {});

    // Move all params to top level
    const params: (Parameter)[] = [];
    const selectParams: (Parameter)[] = [];

    // Function to find base chart layer by rootComponentId
    const findBaseChartLayer = (obj: any): any | null => {
        if (!obj || typeof obj !== 'object') return null;
        
        if (obj.name === rootComponentId) return obj;
        
        for (const value of Object.values(obj)) {
            const result = findBaseChartLayer(value);
            if (result) return result;
        }
        
        return null;
    };

    // Function to move params to top level
    const moveParamsToTop = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        if (obj.params && Array.isArray(obj.params)) {
            // Split params into select and non-select
            const [selectParamsArr, nonSelectParamsArr] = obj.params.reduce(
                ([select, nonSelect]: [Parameter[], Parameter[]], param: Parameter) => {
                    if ('select' in param) {
                        select.push(param);
                    } else {
                        nonSelect.push(param);
                    }
                    return [select, nonSelect];
                },
                [[], []]
            );
            
            // Add to respective arrays
            if (nonSelectParamsArr.length > 0) {
                params.push(...nonSelectParamsArr);
            }
            if (selectParamsArr.length > 0) {
                selectParams.push(...selectParamsArr);
            }
            
            // Remove params from original location
            delete obj.params;
        }
        
        Object.values(obj).forEach(value => {
            moveParamsToTop(value);
        });
    };

    // Move params to their destinations
    moveParamsToTop(mergedSpec);

    // Add select params to base chart
    const baseChartLayer = findBaseChartLayer(mergedSpec);
    if (baseChartLayer && selectParams.length > 0) {
        baseChartLayer.params = selectParams;
    }
    if (params.length > 0) {

        mergedSpec.params = mergeParams(params);
    }

    return mergedSpec;
}

function mergeParams(params: any[]): any[] {
    const paramsByName = new Map<string, any>();
    
    // Group params by name
    params.forEach(param => {
        if (!param.name) return;
        
        if (paramsByName.has(param.name)) {
            // Merge with existing param
            const existing = paramsByName.get(param.name);
            paramsByName.set(param.name, {
                ...existing,
                ...param
            });
        } else {
            paramsByName.set(param.name, param);
        }
    });

    return Array.from(paramsByName.values());
}

