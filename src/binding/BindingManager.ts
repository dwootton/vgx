import { BaseComponent } from "components/base";
import { AnchorGroupSchema, AnchorProxy, AnchorType } from "types/anchors";
import { Field } from "vega-lite/build/src/channeldef";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext, deduplicateById, groupEdgesByChannel, resolveChannelValue, validateComponent, removeUndefinedInSpec ,logComponentInfo} from "./binding";
import {getProxyAnchor,expandGroupAnchors} from '../utils/anchorProxy';

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
        console.log('added binding', sourceId, targetId, sourceAnchor, targetAnchor)
                
    };
       
    

    public getBindingsForComponent(componentId: string): Binding[] {
        return this.bindings.filter(binding =>
            binding.sourceId === componentId || binding.targetId === componentId
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


            bindingManager.getBindingsForComponent(componentId).forEach(binding => {
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

        const bindingGraph = this.graphManager.generateBindingGraph(rootComponent.id);

        const compiledSpecs = this.compileBindingGraph(bindingGraph);
        const mergedSpec = this.mergeSpecs(compiledSpecs);

        return removeUndefinedInSpec(mergedSpec);
    }

    private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        const { nodes, edges } = bindingGraph;
        const compiledComponents: Partial<UnitSpec<Field>>[] = [];

        for (const node of nodes.values()) {
            const compiledNode = this.compileNode(node, edges);
            compiledComponents.push(compiledNode);
        }

        return compiledComponents;
    }

    private compileNode(node: BindingNode, graphEdges: BindingEdge[]): Partial<UnitSpec<Field>> {
        const edges = this.prepareNodeEdges(node, graphEdges);
        const compilationContext = this.buildCompilationContext(edges);
        return this.compileComponentWithContext(node.id, compilationContext);
    }

    private prepareNodeEdges(node: BindingNode, graphEdges: BindingEdge[]): AnchorProxy[] {
        const nodeEdges = graphEdges
            .filter(edge => edge.target.nodeId === node.id)
            .map(edge => getProxyAnchor(edge, this.getBindingManager().getComponent(edge.source.nodeId)));

        const expandedEdges = nodeEdges.flatMap(edge =>
            expandGroupAnchors(edge, edge.component)
        );

        return deduplicateById(expandedEdges);
    }

    private buildCompilationContext(edges: AnchorProxy[]): compilationContext {
        const groupedEdges = groupEdgesByChannel(edges);
        
        // to log component name
        // logComponentInfo(groupedEdges as Map<string, AnchorProxy[]>, this.getBindingManager());
        
        const context: compilationContext = {};

        console.log('binding manager', this.getBindingManager())
        this.getBindingManager().getVirtualBindings().forEach((virtualBinding, channel) => {
            groupedEdges.get(channel)?.push(virtualBinding);
        });

        for (const [channel, channelEdges] of groupedEdges) {
            // Get the component for this channel if it exists
       
            context[channel] = resolveChannelValue(channelEdges);
        }

        console.log('context', context)

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

    private mergeSpecs(specs: Partial<UnitSpec<Field>>[]): TopLevelSpec {
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
        const params: any[] = [];
        const moveParamsToTop = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            
            if (obj.params && Array.isArray(obj.params)) {
                params.push(...obj.params);
                delete obj.params;
            }
            
            Object.values(obj).forEach(value => {
                moveParamsToTop(value);
            });
        };

        moveParamsToTop(mergedSpec);
        if (params.length > 0) {
            mergedSpec.params = params;
        }

        return mergedSpec;
    }
}


// export class BindingManager {
//     private static instance: BindingManager;
//     private bindings: Binding[] = [];
//     private virtualBindings: Map<string, VirtualBindingEdge> = new Map();
//     private components: Map<string, BaseComponent> = new Map();

//     public static getInstance(): BindingManager {
//         if (!BindingManager.instance) {
//             BindingManager.instance = new BindingManager();
//         }
//         return BindingManager.instance;
//     }

//     public addVirtualBinding(channel: string, virtualBinding: VirtualBindingEdge): void {
//         this.virtualBindings.set(channel, virtualBinding);
//     }

//     public compile(fromComponentId: string): TopLevelSpec {

//         const rootComponent = this.getComponent(fromComponentId);
//         if(!rootComponent){
//             throw new Error(`Component "${fromComponentId}" not added to binding manager`);
//         }

//         const bindingGraph = this.generateBindingGraph(rootComponent.id);

//         const compiledSpecs = this.compileBindingGraph(bindingGraph);

//         const mergedSpec = this.mergeSpecs(compiledSpecs);

//         function removeUndefinedInSpec(obj: TopLevelSpec): TopLevelSpec {
//             if (!obj || typeof obj !== 'object') {
//                 return obj;
//             }

//             if (Array.isArray(obj)) {
//                 //@ts-ignore TODO
//                 return obj.map(item => removeUndefinedInSpec(item)).filter(item => item !== undefined);
//             }

//             const result: any = {};
//             for (const [key, value] of Object.entries(obj)) {
//                 if (value === undefined) continue;
                
//                 const cleanValue = removeUndefinedInSpec(value);
//                 if (cleanValue !== undefined) {
//                     result[key] = cleanValue;
//                 }
//             }
//             return result;
//         }



//         return removeUndefinedInSpec(mergedSpec);
//     }

//     private mergeSpecs(specs: Partial<UnitSpec<Field>>[]): TopLevelSpec {
//         // Helper to check if spec has layer/mark
//         const hasLayerOrMark = (spec: any) => {
//             return spec.layer || spec.mark;
//         };


//         // First merge specs, handling layers
//         const mergedSpec = specs.reduce((merged: any, spec) => {
//             // If either has layer/mark, create layer spec
//             if (hasLayerOrMark(merged) && hasLayerOrMark(spec)) {
//                 return {
//                     layer: [
//                         merged,
//                         spec
//                     ]
//                 };
//             }

//             // Otherwise merge normally
//             return {
//                 ...merged,
//                 ...spec,
//                 // Concatenate params if they exist
//                 params: [
//                     ...(merged.params || []),
//                     ...(spec.params || [])
//                 ]
//             };
//         }, {});

//         // Move all params to top level
//         const params: any[] = [];
//         const moveParamsToTop = (obj: any) => {
//             if (!obj || typeof obj !== 'object') return;
            
//             if (obj.params && Array.isArray(obj.params)) {
//                 params.push(...obj.params);
//                 delete obj.params;
//             }
            
//             Object.values(obj).forEach(value => {
//                 moveParamsToTop(value);
//             });
//         };

//         moveParamsToTop(mergedSpec);
//         if (params.length > 0) {
//             mergedSpec.params = params;
//         }

//         return mergedSpec;
//     }

//     /**
//      * Compiles the binding graph
//      */
//     private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
//         const { nodes, edges } = bindingGraph;

//         const compiledComponents:Partial<UnitSpec<Field>>[] = [];
//         for (const node of nodes.values()) {
//             const compiledNode = this.compileNode(node, edges);
//             compiledComponents.push(compiledNode);
//         }
//         return compiledComponents;
//     }

//     /**
//      * Compiles a node with the given edges
//      */
//     private compileNode(node: BindingNode, graphEdges: BindingEdge[]): Partial<UnitSpec<Field>> {
//         const edges = this.prepareNodeEdges(node, graphEdges);
//         const compilationContext = this.buildCompilationContext(edges);
//         return this.compileComponentWithContext(node.id, compilationContext);
//     }

   
//     /**
//      * Isolates the edges that point to this node, expands group anchors, and deduplicates
//      */
//     private prepareNodeEdges(node: BindingNode, graphEdges: BindingEdge[]): AnchorProxy[] {
//         const nodeEdges = graphEdges
//             .filter(edge => edge.target.nodeId === node.id)
//             .map(edge => getProxyAnchor(edge, this.getComponent(edge.source.nodeId)));

//         const expandedEdges = nodeEdges.flatMap(edge => 
//             expandGroupAnchors(edge, edge.component));

//         return deduplicateById(expandedEdges);
//     }

//     /**
//      * Groups edges by channel and resolves the value for each channel
//      */
//     private buildCompilationContext(edges: AnchorProxy[]): compilationContext {
//         const groupedEdges = groupEdgesByChannel(edges);
//         const context: compilationContext = {};

//         // add the virtual bindings
//         this.virtualBindings.forEach((virtualBinding, channel) => {
//             groupedEdges.get(channel)?.push(virtualBinding);
//         });

//         for (const [channel, channelEdges] of groupedEdges) {
//             context[channel] = resolveChannelValue(channelEdges);
//         }

//         return context;
//     }

//     /**
//      * Compiles a component with the given context
//      */
//     private compileComponentWithContext(nodeId: string, context: compilationContext): Partial<UnitSpec<Field>> {
//         const component = this.getComponent(nodeId);
//         if(!component){
//             throw new Error(`Component "${nodeId}" not added to binding manager`);
//         }
//         validateComponent(component, nodeId);
//         return component.compileComponent(context);
//     }

//     // Simplified component management
//     public getComponent(id: string): BaseComponent | undefined {
//         return this.components.get(id);
//     }

//     public addComponent(component: BaseComponent): void {
//         this.components.set(component.id, component);
//     }

//     // Simplified binding management
//     public addBinding(sourceId: string, targetId: string, sourceAnchor: string, targetAnchor: string): void {
//         this.bindings.push({ sourceId, targetId, sourceAnchor, targetAnchor });
//     }

//     public getBindingsForComponent(componentId: string): Binding[] {
//         return this.bindings.filter(binding =>
//             binding.sourceId === componentId || binding.targetId === componentId
//         );
//     }

//     // Graph generation
//     public generateBindingGraph(startComponentId: string): BindingGraph {
//         const nodes = new Map<string, BindingNode>();
//         const edges: BindingEdge[] = [];
//         const visited = new Set<string>();

//         const addNode = (component: BaseComponent) => {
//             if (!nodes.has(component.id)) {
//                 nodes.set(component.id, {
//                     id: component.id,
//                     type: component.constructor.name,
//                 });
//             }
//         };

//         const traverse = (componentId: string) => {
//             if (visited.has(componentId)) return;
//             visited.add(componentId);

//             const component = this.getComponent(componentId);
//             if (!component) return;

//             addNode(component);

//             this.getBindingsForComponent(componentId).forEach(binding => {
//                 const { sourceId, targetId, sourceAnchor, targetAnchor } = binding;

//                 [sourceId, targetId].forEach(id => {
//                     const comp = this.getComponent(id);
//                     if (comp) addNode(comp);
//                 });

//                 edges.push({
//                     source: { nodeId: sourceId, anchorId: sourceAnchor },
//                     target: { nodeId: targetId, anchorId: targetAnchor }
//                 });

//                 traverse(sourceId);
//                 traverse(targetId);
//             });
//         };

//         traverse(startComponentId);
//         return { nodes, edges };
//     }

//     // Debug helper
//     public printGraph(startComponentId: string): void {
//         const { nodes, edges } = this.generateBindingGraph(startComponentId);

//         nodes.forEach(node =>
//             console.log(`  ${node.id} (${node.type})\n}`)
//         );

//         console.log('\nEdges:');
//         edges.forEach(edge =>
//             console.log(`  ${edge.source.nodeId}.${edge.source.anchorId} -> ${edge.target.nodeId}.${edge.target.anchorId}`)
//         );
//     }
// }
