import { BaseComponent } from "components/base";
import { AnchorGroupSchema, AnchorProxy, AnchorType } from "types/anchors";
import { Field } from "vega-lite/build/src/channeldef";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
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



        console.log(bindingGraph);
        return removeUndefinedInSpec(mergedSpec);
    }

    private mergeSpecs(specs: Partial<UnitSpec<Field>>[]): TopLevelSpec {
        // Helper to check if spec has layer/mark
        const hasLayerOrMark = (spec: any) => {
            return spec.layer || spec.mark;
        };


        console.log('specs', specs);
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

    private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        // for each node, go through and gene

        const nodes = bindingGraph.nodes;
        const edges = bindingGraph.edges;
        const compiledComponents:Partial<UnitSpec<Field>>[] = [];

        // for each node, create its compilation context 
        for (const node of nodes.values()) {
            // get the edges that point to this node
            const edgeIds = bindingGraph.edges.filter(edge => edge.target.nodeId === node.id);
            let edges = edgeIds.map(edge => getProxyAnchor(edge, this.getComponent(edge.source.nodeId)));
            console.log('edges', edges);

            
            // for each edge, expand it (e iteratively go through and expand out any group anchors)
            edges = edges.flatMap(edge => expandGroupAnchors(edge, edge.component));
            // dedupe 
            edges = edges.filter((edge, index, self) =>
                index === self.findIndex((t) => t.id === edge.id)
            );

            // now we have a list of all of the inputs for this node. 
            // for each of these, generate the compilation context

            // go through and group each edge according to its channel name
            function groupEdgesByChannel(edges: AnchorProxy[]) {
                const groupedEdges: Map<string, AnchorProxy[]> = new Map();
                for (const edge of edges) {
                    console.log('edge', edge);
                    const channel = edge.id.anchorId;
                    if (!groupedEdges.has(channel)) {
                        groupedEdges.set(channel, []);
                    }
                    groupedEdges.get(channel)?.push(edge);
                }
                console.log('grouped edges', groupedEdges);
                return groupedEdges;
            }

            const groupedEdges = groupEdgesByChannel(edges);

            const compilationContext:compilationContext = {};

            // for each of these groups, generate the compilation context
            for (const [channel, edges] of groupedEdges.entries()) {
                console.log('channel', channel);
                console.log('edges', edges);

                // for each of these edges, get the corresponding component and ask for it to provide that compilation context
                const generatedData:{expr:string,type:AnchorType}[] = [];
                for (const edge of edges) {
                    const edgeData = edge.compile();//component.getData(channel);
                    generatedData.push({expr:edgeData,type:edge.anchorSchema.type});
                    console.log('generatedData', generatedData);
                }

                compilationContext[channel] = generatedData.map(data => data.expr).join(',');

            }

            const component = this.getComponent(node.id);
            if(!component){
                throw new Error(`Component "${node.id}" not added to binding manager`);
            }

            const compiledComponent = component.compileComponent(compilationContext);

            compiledComponents.push(compiledComponent);





            console.log('compilationContext', compiledComponent);



            //const compilationContext = {}
            // get the anchorSchema for each of the edges 

            const anchorSchemas: AnchorGroupSchema[] = [];

            // function expandEdges(edges: BindingEdge[]) {
            //     // go through each edge, get the anchor shcema, and then apply the correct bindings to any group anchors
            //     for (const edge of edges) {
            //         const sourceComponent = this.getComponent(edge.source.nodeId);
            //         if (!sourceComponent) {
            //             throw new Error(`Component "${edge.source.nodeId}" not added to binding manager`);
            //         }
            //         const sourceAnchor = edge.source.anchorId;
            //         const anchorProxy = sourceComponent.getAnchor(sourceAnchor);
            //         const anchorSchema = anchorProxy.anchorSchema;
            //         /
            //         console.log('anchorSchema', anchorSchema);
            //         if (anchorSchema) {
            //             anchorSchemas.push(anchorSchema);
            //         }
            //     }
            // }
            

            // for each edge, get the corresponding component and ask for it to provide that compilation context



            // for each edge, get the corresponding component and ask for it to provide that compilation context

            // got hrough and resolve group anchors 
            



            
            
            // if (!component) {
            //     throw new Error(`Component "${node.id}" not added to binding manager`);
            // }
            // const compilationContext = component.compile();
        }

        console.log('compiledComponents', compiledComponents);



        return compiledComponents;
    }


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

        console.log('Nodes:');
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
                    // You might want to store this binding information somewhere
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
