import { BaseComponent } from "components/base";
import { AnchorGroupSchema, AnchorProxy, AnchorIdentifer } from "types/anchors";
import { Field } from "vega-lite/build/src/channeldef";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext, deduplicateById, groupEdgesByAnchorId, validateComponent, removeUndefinedInSpec ,logComponentInfo, detectAndMergeSuperNodes,  resolveAnchorValue} from "./binding";
import {getProxyAnchor,expandGroupAnchors} from '../utils/anchorProxy';
import { VariableParameter } from "vega-lite/build/src/parameter";
import {TopLevelSelectionParameter} from "vega-lite/build/src/selection"
import { getChannelFromEncoding } from "../utils/anchorGeneration/rectAnchors";
import {Edge} from "./binding"
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

    public getComponent(id: string): BaseComponent {
        const component = this.components.get(id);
        if (!component) {
            throw new Error(`Component "${id}" not found.`);
        }
        return component;
    }

    public getGraphManager(): GraphManager {
        return this.graphManager;
    }

    public compile(fromComponentId: string): TopLevelSpec {
        return this.specCompiler.compile(fromComponentId);
    }

   
    private constructor() {
        // Initialize dependencies lazily
        this.graphManager = new GraphManager( ()=>this);
        this.specCompiler = new SpecCompiler(this.graphManager, ()=>this);
        console.log('BindingManager initialized',this)
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

    private superNodes: Map<string, string> = new Map();
    public setSuperNodes(superNodeMap: Map<string, string>): void {
        this.superNodes = superNodeMap;
    }

    public getSuperNodes(): Map<string, string> {
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


export class SpecCompiler {
    constructor(
        private graphManager: GraphManager,
        private getBindingManager: () => BindingManager // Getter for BindingManager
    ) {}

    private hierarchyEdges: Map<string, BindingEdge[]> = new Map();


    // note: component Id will always be called from the root component
    public compile(fromComponentId: string): TopLevelSpec {

        const rootComponent = this.getBindingManager().getComponent(fromComponentId);
        if (!rootComponent) {
            throw new Error(`Component "${fromComponentId}" not found.`);
        }

        // specific binding graph for this tree
        let bindingGraph = this.graphManager.generateBindingGraph(rootComponent.id);
       
        // Compile the updated graph
        const compiledSpecs = this.compileBindingGraph(bindingGraph);

        //const compiledSpecs = this.compileBindingGraph(bindingGraph);
        const mergedSpec = mergeSpecs(compiledSpecs,  rootComponent.id);

        return removeUndefinedInSpec(mergedSpec);
    }
    
    

    private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        const { nodes, edges } = bindingGraph;
        const compiledComponents: Partial<UnitSpec<Field>>[] = [];

        const superNodeMap : Map<string, string>= detectAndMergeSuperNodes(edges);
        this.graphManager.setSuperNodes(superNodeMap);




        for (const node of nodes.values()) {
            const compiledNode = this.compileNode(node, edges);
            compiledComponents.push(compiledNode);
        }

        return compiledComponents;
    }

    
    private compileNode(node: BindingNode, graphEdges: BindingEdge[]): Partial<UnitSpec<Field>> {

        const filteredEdges = graphEdges.filter(edge => edge.target.nodeId === node.id )
        const incomingAnchors : AnchorProxy[] = this.prepareEdges(filteredEdges)


        const superNodeMap : Map<string, string>= this.graphManager.getSuperNodes();

        let compilationContext = {nodeId: superNodeMap.get(node.id) || node.id};
        console.log('supernode map',superNodeMap, compilationContext)

        let component = this.getBindingManager().getComponent(node.id);

        

        console.log('incomingAnchors',incomingAnchors, component)
        compilationContext = this.buildPersonalizedCompilationContext(component, incomingAnchors, compilationContext);

        compilationContext = this.scalePropagation(node.id,compilationContext);


        // at this point compilationContext will have a grouped and ordered list of corresponding values. 
        

        console.log('compilationContext',compilationContext)
        const compiledSpec = this.compileComponentWithContext(node.id, compilationContext);
        return compiledSpec;
    }

    private findRootNode(nodeId: string): string {
        const bindingManager = this.getBindingManager();
        // search up the binding graph until we find the root node
        let currentId = nodeId;
        // while (bindingManager.getSourceBindingsForComponent(currentId).length > 0) {
        //     console.log('currentId',currentId)
        //     currentId = bindingManager.getTargetBindingsForComponent(currentId)[0].sourceId;
        // }
        return currentId;
    }

    private scalePropagation(nodeId: string, compilationContext: compilationContext): compilationContext {
        // Find root node by traversing up the binding graph
        console.log('scale Propagation',compilationContext)
        const rootNodeId = 'node_2' //this.findRootNode(nodeId);
        if (!rootNodeId) return compilationContext;

        const rootComponent = this.getBindingManager().getComponent('node_2');
        if (!rootComponent) return compilationContext;

        // For each key in compilation context
        for (const [key, value] of Object.entries(compilationContext)) {
            if (key === 'nodeId') continue;
            // Get all anchors from root component
            const rootAnchors = rootComponent.getAnchors();
            
            // Try to find matching anchor by id or channel name
            const rootAnchor = rootAnchors.find(anchor => {
                const anchorId = anchor.id.anchorId;
                const channelName = getChannelFromEncoding(key);

                return anchorId === key || channelName === anchorId;
            });
            if (!rootAnchor) continue;

            // Compile the root anchor's value
            const compiledValue = rootAnchor.compile?.(rootNodeId);
            if (!compiledValue) continue;
            // Add scale and scaleType from root to current context if they exist
            if (compiledValue.value?.scale) {
                compilationContext[key].scale = compiledValue.value.scale;
            }
            if (compiledValue.value?.scaleType) {
                compilationContext[key].scaleType = compiledValue.value.scaleType;
            }
        }
        return compilationContext;
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
        const groupedEdges = groupEdgesByAnchorId(edges);
        
        // to log component name
        // logComponentInfo(groupedEdges as Map<string, AnchorProxy[]>, this.getBindingManager());

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

    private buildPersonalizedCompilationContext(component: BaseComponent, edges: AnchorProxy[], compilationContext: compilationContext): compilationContext {
        // for each of component's anchors, we need to produce a group of the edges that are associated with that anchor
        
        const anchors = component.getAnchors();
       

        const groupedEdges = groupEdgesByAnchorId(edges);

        console.log('groupedEdges',groupedEdges)

        this.getBindingManager().getVirtualBindings().forEach((virtualBinding, channel) => {
            groupedEdges.get(channel)?.push(virtualBinding);
        });
        

        // filter to only the anchors that are in the component.
        const anchorMatchedEdges = new Map<string, Edge[]>();
        
        // Only keep edge groups where the anchor ID exists in component's anchors
        for (const [anchorId, edges] of groupedEdges.entries()) {
            if (anchors.some(anchor => anchor.id.anchorId === anchorId)) {
                anchorMatchedEdges.set(anchorId, edges);
            }
        }


        // point.x needs to be able to have all of the edges that are x resolve to it.
        // brush.x1 needs to have only the edges that are x1 resolve to it. 
        // these aren't necessarily 

        const channelMatchedEdges = new Map<string, Edge[]>();
        // For each edge group, check if it represents a channel encoding
        for (const [anchorId, edges] of groupedEdges.entries()) {
            const channel = getChannelFromEncoding(anchorId);
            if (channel) {
                channelMatchedEdges.set(anchorId, edges);
            }
        }

        // Merge channel and anchor matched edges
        // If an anchor already exists in anchorMatchedEdges, append any additional channel edges
        // Otherwise add the channel edges as a new entry
        for (const [channelId, edges] of channelMatchedEdges.entries()) {
            if (anchorMatchedEdges.has(channelId)) {
                const existingEdges = anchorMatchedEdges.get(channelId) || [];
                anchorMatchedEdges.set(channelId, [...existingEdges, ...edges]);
            } else {
                anchorMatchedEdges.set(channelId, edges);
            }
        }

        console.log('anchorMatchedEdges',anchorMatchedEdges)





        // now for each of the anchorMatchedEdges, we need to resolve the value of the edges
        for (const [anchorId, edges] of anchorMatchedEdges.entries()) {
            const resolvedValue = resolveAnchorValue(edges, compilationContext.nodeId);
            compilationContext[anchorId] = resolvedValue;
        }


            // Add scale propagation from parent components
        const hierarchyAncestors = this.getHierarchyAncestors(compilationContext.nodeId);
        console.log('hierarchyAncestors',hierarchyAncestors)

        hierarchyAncestors.forEach(ancestorId => {
            const ancestorSpec = this.compileComponentWithContext(ancestorId, compilationContext);
            Object.entries(ancestorSpec.encoding || {}).forEach(([channel, enc]) => {
                console.log('channel',channel)
                if (!compilationContext[channel]?.scale ) {
                    compilationContext[channel] = {
                        ...compilationContext[channel],
                        scale: enc?.scale,
                        scaleType: enc?.scale?.type
                    };
                }
            });
        });

        
        return compilationContext

        // TODO, channel edges have second priorty. 
        // for example, if a brush.left : drag_line, then we need to resolve brush.x1 (left), to drag_line.x, 
        // so if none of the edges have a direct map, then we use channel edges to resolve the value
        



        //console.log('personalized anchorMatchedEdges',anchorMatchedEdges)
        // console.log('personalized filteredChannelEdges',filteredChannelEdges)


        // we need to then resolve the value of each of the edges in the group

        // we need to then add the resolved value to the compilationContext
    }


    private getHierarchyAncestors(nodeId: string): string[] {
        const ancestors: string[] = [];
        let currentId = nodeId;
        
        while (this.hierarchyEdges.has(currentId)) {
            const edges = this.hierarchyEdges.get(currentId)!;
            edges.forEach(edge => {
                ancestors.push(edge.source.nodeId);
                currentId = edge.source.nodeId;
            });
        }
        
        return ancestors;
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

