import { BaseComponent } from "components/base";
import { AnchorGroupSchema, AnchorProxy, AnchorType } from "types/anchors";
import { Field } from "vega-lite/build/src/channeldef";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext, deduplicateById, groupEdgesByChannel, resolveChannelValue, validateComponent } from "./binding";

interface BindingNode {
    id: string;
    type: string;
}

interface BindingEdge {
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


function findRootComponent(bindingManager: BindingManager, componentId: string): BaseComponent {
    const bindings = bindingManager.getBindingsForComponent(componentId);

    const sourceBindings = bindings.filter(binding => binding.targetId === componentId);
    for (const binding of sourceBindings) {
        // if the called component is the target of the binding, then we need to find the source of the binding
        if (binding.targetId === componentId) {
            const sourceId = binding.sourceId;
            return findRootComponent(bindingManager, sourceId);
        }
    }
    const component = bindingManager.getComponent(componentId);
    if (!component) {
        throw new Error(`Component "${componentId}" not added to binding manager`);
    }
    return component;
}


export class BindingManager {
    private static instance: BindingManager;
    private bindings: Binding[] = [];
    private components: Map<string, BaseComponent> = new Map();

    public static getInstance(): BindingManager {
        if (!BindingManager.instance) {
            BindingManager.instance = new BindingManager();
        }
        return BindingManager.instance;
    }

    public compile(fromComponentId: string): TopLevelSpec {

        const rootComponent = this.getComponent(fromComponentId);
        if(!rootComponent){
            throw new Error(`Component "${fromComponentId}" not added to binding manager`);
        }

        const bindingGraph = this.generateBindingGraph(rootComponent.id);

        const compiledSpecs = this.compileBindingGraph(bindingGraph);

        const mergedSpec = this.mergeSpecs(compiledSpecs);

        function removeUndefinedInSpec(obj: TopLevelSpec): TopLevelSpec {
            if (!obj || typeof obj !== 'object') {
                return obj;
            }

            if (Array.isArray(obj)) {
                //@ts-ignore TODO
                return obj.map(item => removeUndefinedInSpec(item)).filter(item => item !== undefined);
            }

            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value === undefined) continue;
                
                const cleanValue = removeUndefinedInSpec(value);
                if (cleanValue !== undefined) {
                    result[key] = cleanValue;
                }
            }
            return result;
        }



        return removeUndefinedInSpec(mergedSpec);
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

    /**
     * Compiles the binding graph
     */
    private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        const { nodes, edges } = bindingGraph;

        const compiledComponents:Partial<UnitSpec<Field>>[] = [];
        for (const node of nodes.values()) {
            const compiledNode = this.compileNode(node, edges);
            compiledComponents.push(compiledNode);
        }
        return compiledComponents;
    }

    /**
     * Compiles a node with the given edges
     */
    private compileNode(node: BindingNode, graphEdges: BindingEdge[]): Partial<UnitSpec<Field>> {
        const edges = this.prepareNodeEdges(node, graphEdges);
        const compilationContext = this.buildCompilationContext(edges);
        return this.compileComponentWithContext(node.id, compilationContext);
    }

   
    /**
     * Isolates the edges that point to this node, expands group anchors, and deduplicates
     */
    private prepareNodeEdges(node: BindingNode, graphEdges: BindingEdge[]): AnchorProxy[] {
        const nodeEdges = graphEdges
            .filter(edge => edge.target.nodeId === node.id)
            .map(edge => getProxyAnchor(edge, this.getComponent(edge.source.nodeId)));

        const expandedEdges = nodeEdges.flatMap(edge => 
            expandGroupAnchors(edge, edge.component));

        return deduplicateById(expandedEdges);
    }

    /**
     * Groups edges by channel and resolves the value for each channel
     */
    private buildCompilationContext(edges: AnchorProxy[]): compilationContext {
        const groupedEdges = groupEdgesByChannel(edges);
        const context: compilationContext = {};

        for (const [channel, channelEdges] of groupedEdges) {
            context[channel] = resolveChannelValue(channelEdges);
        }

        return context;
    }

    /**
     * Compiles a component with the given context
     */
    private compileComponentWithContext(nodeId: string, context: compilationContext): Partial<UnitSpec<Field>> {
        const component = this.getComponent(nodeId);
        if(!component){
            throw new Error(`Component "${nodeId}" not added to binding manager`);
        }
        validateComponent(component, nodeId);
        return component.compileComponent(context);
    }



    // private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
    //     // for each node, go through and gene

    //     const nodes = bindingGraph.nodes;
    //     const edges = bindingGraph.edges;
    //     const compiledComponents:Partial<UnitSpec<Field>>[] = [];

    //     // for each node, create its compilation context 
    //     for (const node of nodes.values()) {
    //         // get the edges that point to this node
    //         const edgeIds = bindingGraph.edges.filter(edge => edge.target.nodeId === node.id);
    //         let edges = edgeIds.map(edge => getProxyAnchor(edge, this.getComponent(edge.source.nodeId)));

            
    //         // for each edge, expand it (e iteratively go through and expand out any group anchors)
    //         edges = edges.flatMap(edge => expandGroupAnchors(edge, edge.component));
    //         // dedupe 
    //         edges = edges.filter((edge, index, self) =>
    //             index === self.findIndex((t) => t.id === edge.id)
    //         );

    //         // now we have a list of all of the inputs for this node. 
    //         // for each of these, generate the compilation context

    //         // go through and group each edge according to its channel name
    //         function groupEdgesByChannel(edges: AnchorProxy[]) {
    //             const groupedEdges: Map<string, AnchorProxy[]> = new Map();
    //             for (const edge of edges) {
    //                 const channel = edge.id.anchorId;
    //                 if (!groupedEdges.has(channel)) {
    //                     groupedEdges.set(channel, []);
    //                 }
    //                 groupedEdges.get(channel)?.push(edge);
    //             }
    //             return groupedEdges;
    //         }

    //         const groupedEdges = groupEdgesByChannel(edges);

    //         const compilationContext:compilationContext = {};
    //         console.log('groupedEdges', groupedEdges,edges);

    //         // for each of these groups, generate the compilation context
    //         for (const [channel, edges] of groupedEdges.entries()) {

    //             // for each of these edges, get the corresponding component and ask for it to provide that compilation context
    //             const generatedData:{expr:string,type:AnchorType}[] = [];
    //             enum DataSource {
    //                 CONTEXT = 'context',
    //                 BASE_CONTEXT = 'baseContext',
    //                 GENERATED = 'generated'
    //             }

    //             // Compile all edges and group by source type
    //             const edgeResults = edges.map(edge => ({
    //                 data: edge.compile(),
    //                 type: edge.anchorSchema.type
    //             }));

    //             // Process edges in priority order: context > generated > baseContext
    //             // Find data sources in priority order
    //             const contextData = edgeResults.find(result => result.data.source === DataSource.CONTEXT);
    //             const generatedDataResults = edgeResults.filter(result => 
    //                 result.data.source !== DataSource.CONTEXT && 
    //                 result.data.source !== DataSource.BASE_CONTEXT
    //             );
    //             const baseContextData = edgeResults.find(result => result.data.source === DataSource.BASE_CONTEXT);

    //             // Process in priority order: context > generated > baseContext
    //             if (contextData) {
    //                 // Context data takes highest priority
    //                 compilationContext[channel] = contextData.data.value;
    //             } else if (generatedDataResults.length > 0) {
    //                 // Generated data is second priority
    //                 generatedData.push(...generatedDataResults.map(result => ({
    //                     expr: result.data.value,
    //                     type: result.type
    //                 })));
    //                 compilationContext[channel] = generatedData.map(data => data.expr).join(',');
    //             } else if (baseContextData) {
    //                 // Base context is lowest priority
    //                 compilationContext[channel] = baseContextData.data.value;
    //             }

    //         }

    //         const component = this.getComponent(node.id);
    //         if(!component){
    //             throw new Error(`Component "${node.id}" not added to binding manager`);
    //         }

    //         console.log('compilationContext', compilationContext);
    //         const compiledComponent = component.compileComponent(compilationContext);

    //         compiledComponents.push(compiledComponent);



            
    //     }




    //     return compiledComponents;
    // }


    // Simplified component management
    public getComponent(id: string): BaseComponent | undefined {
        return this.components.get(id);
    }

    public addComponent(component: BaseComponent): void {
        this.components.set(component.id, component);
    }

    // Simplified binding management
    public addBinding(sourceId: string, targetId: string, sourceAnchor: string, targetAnchor: string): void {
        this.bindings.push({ sourceId, targetId, sourceAnchor, targetAnchor });
    }

    public getBindingsForComponent(componentId: string): Binding[] {
        return this.bindings.filter(binding =>
            binding.sourceId === componentId || binding.targetId === componentId
        );
    }

    // Graph generation
    public generateBindingGraph(startComponentId: string): BindingGraph {
        const nodes = new Map<string, BindingNode>();
        const edges: BindingEdge[] = [];
        const visited = new Set<string>();

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

            const component = this.getComponent(componentId);
            if (!component) return;

            addNode(component);

            this.getBindingsForComponent(componentId).forEach(binding => {
                const { sourceId, targetId, sourceAnchor, targetAnchor } = binding;

                [sourceId, targetId].forEach(id => {
                    const comp = this.getComponent(id);
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

    // Debug helper
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
function getProxyAnchor(edge: BindingEdge, sourceComponent: BaseComponent | undefined) {
    if (!sourceComponent) {
        throw new Error(`Component "${edge.source.nodeId}" not added to binding manager`);
    }
    const sourceAnchor = edge.source.anchorId;
    return sourceComponent.getAnchor(sourceAnchor);
}


function expandGroupAnchors(edge: AnchorProxy, component: BaseComponent | undefined) {
    if (!component) {
        throw new Error(`Component "${edge.id}" not added to binding manager`);
    }
    // for each edge, expand it (e iteratively go through and expand out any group anchors)
    const edges: AnchorProxy[] =[];
    const anchorSchema = edge.anchorSchema;
    if (anchorSchema.type === 'group') {
        // get the children of the group
        const children = (anchorSchema as AnchorGroupSchema).children;
        // for each child, get the proxy anchor and add it to the edges
        children.forEach(child => {
            console.log('child', child,children);
            const childAnchor = child.id;
            const childProxy = component.getAnchor(childAnchor);
            edges.push(childProxy);
        });
    }
    return edges;
}
// Function to make properties bindable
export function anchorize<T extends object>(obj: T): T {
    const handler: ProxyHandler<T> = {
        get(target: T, prop: string | symbol): any {
            if (prop === 'bind') {
                return function (this: any, target: any) {
                    // Implement binding logic here
                    console.log(`Binding ${String(prop)} to`, target);
                    
                };
            }

            const value = target[prop as keyof T];
            if (typeof value === 'object' && value !== null) {
                return new Proxy(value as object, handler) as any;
            }

            return value;
        }
    };

    return new Proxy(obj, handler);
}
