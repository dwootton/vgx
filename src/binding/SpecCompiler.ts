import { BindingEdge, GraphManager, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager, VirtualBindingEdge, } from "./BindingManager";
import { compilationContext, deduplicateById, validateComponent, removeUndefinedInSpec, logComponentInfo, detectAndMergeSuperNodes, resolveAnchorValue } from "./binding";
import { AnchorProxy, SchemaType, SchemaValue, RangeValue, SetValue, ScalarValue } from "../types/anchors";
import { BaseComponent } from "../components/base";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { VariableParameter } from "vega-lite/build/src/parameter";
import { TopLevelSelectionParameter } from "vega-lite/build/src/selection"
import { BaseChart } from "../components/charts/base";
import { getChannelFromEncoding } from "../utils/anchorGeneration/rectAnchors";

interface AnchorEdge {
    originalEdge: BindingEdge;
    anchorProxy: AnchorProxy;
}

export type Edge = AnchorEdge | VirtualBindingEdge;
type Parameter = VariableParameter | TopLevelSelectionParameter

type AnchorId = string;
type Constraint = string;

function generateScalarConstraints(schema: SchemaType, value: SchemaValue): string {
    if (schema.container === 'Range') {
        value = value as RangeValue
        return `clamp(${'VGX_SIGNAL_NAME'},${value.start},${value.stop})`
    }
    if (schema.container === 'Set') {
        value = value as SetValue
        return `nearest(${'VGX_SIGNAL_NAME'},${value.values})`
    }
    if (schema.container === 'Scalar') {
        value = value as ScalarValue
        return `clamp(${'VGX_SIGNAL_NAME'},${value},${value})`
    }
    return "";
}

// 
function generateRangeConstraints(schema: SchemaType, value: SchemaValue): string {
    if (schema.container === 'Range') {
        //TODO SOMETHING WEIRD IS HAPPIGN HERE WHERE RECT IS GIVING WEIRD UPDATES TO THIS
        value = value as RangeValue

        // range:range, means start=start, stop=stop
        return `nearest(${'VGX_SIGNAL_NAME'},[${value.start},${value.stop}])`
    }
    if (schema.container === 'Set') {
        value = value as SetValue
        return `nearest(${'VGX_SIGNAL_NAME'},${value.values})`
    }
    if (schema.container === 'Scalar') {
        // !!!!!!!!! NOTE THIS IS DIFF THAN SCALAR CODE AS WE OFFSET instead of share !!!!!!!!!
        value = value as ScalarValue
        return `${'VGX_SIGNAL_NAME'}+${value}`
    }
    return "";
}

// The goal of the spec compiler is to take in a binding graph and then compute
export class SpecCompiler {
    constructor(
        private graphManager: GraphManager,
        private getBindingManager: () => BindingManager // Getter for BindingManager
    ) { }


    // note: component Id will always be called from the root component
    public compile(fromComponentId: string): TopLevelSpec {

        const rootComponent = this.getBindingManager().getComponent(fromComponentId);
        if (!rootComponent) {
            throw new Error(`Component "${fromComponentId}" not found.`);
        }

        // specific binding graph for this tree
        let bindingGraph = this.graphManager.generateBindingGraph(rootComponent.id);

        // Compile the updated graph
        const compiledSpecs = this.compileBindingGraph(fromComponentId, bindingGraph);

        //const compiledSpecs = this.compileBindingGraph(bindingGraph);
        const mergedSpec = mergeSpecs(compiledSpecs, rootComponent.id);

        return removeUndefinedInSpec(mergedSpec);
    }



    private compileBindingGraph(rootId: string, bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        const { nodes, edges } = bindingGraph;


        const expandedEdges = expandEdges(edges);
        console.log('expandedEdges', expandedEdges)


        // go through the binding tree and compile each node, passing the constraints from parents
        // to their children, to help to compile. 
        const preOrderTraversal = (
            node: BindingNode, 
            edges: BindingEdge[], 
            visitedNodes = new Set<string>()
        ): Partial<UnitSpec<Field>>[] => {
            // If this node has already been processed, skip it
            if (visitedNodes.has(node.id)) {
                console.log('visitedNodes', visitedNodes)
                return [];
            }
            
            // Mark this node as visited
            visitedNodes.add(node.id);
            
            // Find all edges where this node is the target
            const parentEdges = edges.filter(edge => edge.target.nodeId === node.id);

            // Create a list of {edge, node} pairs to preserve the relationship between edges and nodes
            const parentEdgePairs = parentEdges.map(edge => {
                const parentNode = nodes.get(edge.source.nodeId);
                return parentNode ? { edge, node: parentNode } : null;
            }).filter((pair): pair is { edge: BindingEdge, node: BindingNode } => pair !== null);

            // Get the component for the current node
            const component = this.getBindingManager().getComponent(node.id);

            // Extract parent anchors from the edge-node pairs
            const parentAnchors = parentEdgePairs.map(({ edge, node }) => {
                const parentComponent = this.getBindingManager().getComponent(node.id);
                if (!parentComponent) return undefined;

                // Get the anchor from the parent component using the source anchorId from the edge
                const anchor = parentComponent.getAnchor(edge.source.anchorId);

                return anchor;
            }).filter((anchor): anchor is AnchorProxy => anchor !== undefined);

            console.log('parentAnchors', parentAnchors)

            const constraints: Record<AnchorId, Constraint[]> = {};

            // for each parent anchor, create what constraints it places on the component
            parentAnchors.forEach((anchorProxy) => {
                Object.keys(anchorProxy.anchorSchema).forEach(channel => {
                    const schema = anchorProxy.anchorSchema[channel];
                    const anchorAccessor = anchorProxy.compile();

                    // Skip channels not present in component schema
                    if (!component.schema[channel]) {
                        return;
                    }

                    // Initialize constraint array if needed
                    if (!constraints[channel]) {
                        constraints[channel] = [];
                    }

                    if (component.schema[channel].container === "Scalar") {
                        console.log('generateScalarConstraints', anchorAccessor, generateScalarConstraints(schema, anchorAccessor))
                        constraints[channel].push(generateScalarConstraints(schema, anchorAccessor));
                    } else if (component.schema[channel].container === "Range") {
                        constraints[channel].push(generateRangeConstraints(schema, anchorAccessor));
                    }
                });
            });

            console.log('constraints', constraints)

            // Compile the current node with the context
            const compiledNode = component.compileComponent(constraints);

            // Find child nodes from edges where this node is the source
            const childEdges = edges.filter(edge => edge.source.nodeId === node.id);
            const childNodes = childEdges.map(edge =>
                nodes.get(edge.target.nodeId)
            ).filter((n): n is BindingNode => n !== undefined);

            // Recursively process child nodes
            const children = childNodes.map(child =>
                preOrderTraversal(child, edges, visitedNodes)  // Pass the visited set to track nodes
            );

            // Flatten the results
            return [compiledNode, ...children.flat()];
        };

        // Start traversal with an empty visited set
        const compiledComponents = preOrderTraversal(nodes.get(rootId)!, expandedEdges, new Set<string>());

        return compiledComponents;
    }




    private compileNode(node: BindingNode, graphEdges: BindingEdge[]): Partial<UnitSpec<Field>> {


        const filteredEdges = graphEdges.filter(edge => edge.target.nodeId === node.id)


        // maybe instead of turn edges into anchors, we should just keep edges, and add anchor property
        const incomingAnchors: AnchorEdge[] = this.prepareEdges(filteredEdges)



        const anchorProxies = incomingAnchors.map(edge => edge.anchorProxy);
        //then, as we compile the node, we pass in the edges and it groups on edge.target.anchorId (then compiles)


        const superNodeMap: Map<string, string> = this.graphManager.getSuperNodeMap();

        let compilationContext = { nodeId: superNodeMap.get(node.id) || node.id };

        let component = this.getBindingManager().getComponent(node.id);

        compilationContext = this.buildPersonalizedCompilationContext(component, incomingAnchors, compilationContext);

        compilationContext = this.scalePropagation(node.id, compilationContext);




        const compiledSpec = this.compileComponentWithContext(node.id, compilationContext);
        return compiledSpec;
    }

    private findRootNode(nodeId: string): string {
        const bindingManager = this.getBindingManager();
        let currentId = nodeId;

        // Keep traversing up until we find a BaseChart component
        const visited = new Set<string>();
        while (true) {
            if (visited.has(currentId)) {
                // We've detected a cycle, return the current node
                break;
            }
            visited.add(currentId);

            const currentComponent = bindingManager.getComponent(currentId);
            // If this is a chart component (has encoding property), we've found our root
            //@ts-ignore
            if (currentComponent && 'spec' in currentComponent && currentComponent.spec.encoding) {
                break;
            }

            const incomingBindings = bindingManager.getBindingsForComponent(currentId, 'target');
            if (incomingBindings.length === 0) {
                break;
            }
            // Take the first incoming binding's source as the next node to check
            currentId = incomingBindings[0].sourceId;
        }

        return currentId;
    }

    private scalePropagation(nodeId: string, compilationContext: compilationContext): compilationContext {
        // Find root node by traversing up the binding graph
        const rootNodeId = this.findRootNode(nodeId)//'node_3' //this.findRootNode(nodeId);

        if (!rootNodeId) return compilationContext;

        const rootComponent = this.getBindingManager().getComponent(rootNodeId);
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

    private prepareEdges(graphEdges: BindingEdge[]): AnchorEdge[] {

        function isCompatible(sourceAnchorId: string, targetAnchor: string) {
            return getChannelFromEncoding(sourceAnchorId) == getChannelFromEncoding(targetAnchor)
        }
        function expandAllAnchors(edge: BindingEdge, source: BaseComponent, target: BaseComponent): BindingEdge[] {
            const getAnchors = (component: BaseComponent, anchorId: string) =>
                anchorId === '_all'
                    ? [...component.getAnchors().values()].map(a => a.id.anchorId)
                    : [anchorId];

            const sourceAnchors = getAnchors(source, edge.source.anchorId);
            const targetAnchors = getAnchors(target, edge.target.anchorId);

            return sourceAnchors.flatMap(sourceAnchor =>
                targetAnchors
                    .filter(targetAnchor => {
                        const sourceType = source.getAnchor(sourceAnchor)?.anchorSchema.type;
                        const targetType = target.getAnchor(targetAnchor)?.anchorSchema.type;
                        return sourceType === targetType && isCompatible(sourceAnchor, targetAnchor);
                    })
                    .map(targetAnchor => ({
                        source: { nodeId: edge.source.nodeId, anchorId: sourceAnchor },
                        target: { nodeId: edge.target.nodeId, anchorId: targetAnchor }
                    }))
            );
        }
        // new issue: we are now dropping baseContext data rather than just retrning null (if nothing is provided.)

        return graphEdges.flatMap(edge => {
            const sourceComponent = BindingManager.getInstance().getComponent(edge.source.nodeId);
            if (!sourceComponent) {
                throw new Error(`Source component ${edge.source.nodeId} not found`);
            }

            // Handle '_all' anchor expansion
            if (edge.source.anchorId === '_all' || edge.target.anchorId === '_all') {
                const targetComponent = BindingManager.getInstance().getComponent(edge.target.nodeId);
                if (!targetComponent) {
                    throw new Error(`Target component ${edge.target.nodeId} not found`);
                }

                return expandAllAnchors(edge, sourceComponent, targetComponent)
                    .flatMap(newEdge => {
                        const anchorProxy = sourceComponent.getAnchor(newEdge.source.anchorId);
                        if (!anchorProxy) return [];
                        return expandGroupAnchors({
                            originalEdge: newEdge,
                            anchorProxy
                        }, sourceComponent);
                    });
            }

            // Handle regular edges
            const anchorProxy = sourceComponent.getAnchor(edge.source.anchorId);
            if (!anchorProxy) return [];
            return expandGroupAnchors({
                originalEdge: edge,
                anchorProxy
            }, sourceComponent);
        });
    }

    private buildPersonalizedCompilationContext(component: BaseComponent, edges: AnchorEdge[], compilationContext: compilationContext): compilationContext {
        const groupedEdges = edges.reduce((acc, edge) => {
            const targetAnchorId = edge.originalEdge.target.anchorId;
            if (!acc.has(targetAnchorId)) {
                acc.set(targetAnchorId, []);
            }
            acc.get(targetAnchorId)?.push(edge);
            return acc;
        }, new Map<string, Edge[]>());


        // now for each of the anchorMatchedEdges, we need to resolve the value of the edges
        for (const [anchorId, edges] of groupedEdges.entries()) {

            const resolvedValue = edges.map(edge => edge.anchorProxy.compile(edge.originalEdge.source.nodeId));

            // i need to know what the parent and what the child interaction schema is here. 


            compilationContext[anchorId] = resolvedValue;
        }

        return compilationContext
    }



    private compileComponentWithContext(nodeId: string, context: compilationContext): Partial<UnitSpec<Field>> {
        const component = this.getBindingManager().getComponent(nodeId);
        if (!component) {
            throw new Error(`Component "${nodeId}" not found.`);
        }
        validateComponent(component, nodeId);

        return component.compileComponent(context);
    }

    public getProcessedGraph(startComponentId: string): ProcessedGraph {
        const bindingGraph = this.graphManager.generateBindingGraph(startComponentId);
        const superNodeMap = detectAndMergeSuperNodes(bindingGraph.edges);

        const processedNodes = Array.from(bindingGraph.nodes.values()).map(node => ({
            id: node.id,
            type: node.type,
            mergedId: superNodeMap.get(node.id) || node.id,
            anchors: this.getComponentAnchors(node.id)
        }));
        const edges = this.prepareEdges(bindingGraph.edges);

        const processedEdges = edges.map(edge => ({
            source: {
                original: edge.originalEdge.source.nodeId,
                merged: superNodeMap.get(edge.originalEdge.source.nodeId) || edge.originalEdge.source.nodeId
            },
            target: {
                original: edge.originalEdge.target.nodeId,
                merged: superNodeMap.get(edge.originalEdge.target.nodeId) || edge.originalEdge.target.nodeId
            },
            anchors: {
                source: edge.anchorProxy.anchorSchema.id,
                target: edge.originalEdge.target.anchorId
            }
        }));



        // Group edges by target anchor (matching compileNode logic)
        const anchorGroups = this.groupEdgesByAnchor(
            bindingGraph.edges.filter(e => e.target.nodeId === startComponentId)
        );

        return {
            nodes: processedNodes,
            edges: processedEdges,
            superNodes: Array.from(superNodeMap.entries()),
            anchorGroups
        };
    }

    private groupEdgesByAnchor(edges: BindingEdge[]): Map<string, EdgeGroup> {
        return edges.reduce((acc, edge) => {
            const anchorId = edge.target.anchorId;
            if (!acc.has(anchorId)) {
                acc.set(anchorId, {
                    anchorId,
                    edges: [],
                    resolvedValue: null
                });
            }
            const group = acc.get(anchorId)!;
            group.edges.push(edge);
            return acc;
        }, new Map<string, EdgeGroup>());
    }

    private getComponentAnchors(nodeId: string): AnchorProxy[] {
        const component = this.getBindingManager().getComponent(nodeId);
        return component ? Array.from(component.getAnchors().values()) : [];
    }
}




export function expandGroupAnchors(
    edge: AnchorEdge,
    component: BaseComponent
): AnchorEdge[] {
    const { originalEdge, anchorProxy } = edge;
    const schema = anchorProxy.anchorSchema;

    if (schema.type === 'group') {

        return schema.children.map(childId => ({
            originalEdge,
            anchorProxy: component.getAnchor(childId)
        }));
    }
    return [edge];
}



function mergeSpecs(specs: Partial<UnitSpec<Field>>[], rootComponentId: string): TopLevelSpec {
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

export interface ProcessedGraph {
    nodes: Array<{
        id: string;
        type: string;
        mergedId: string;
        anchors: AnchorProxy[];
    }>;
    edges: Array<{
        source: { original: string; merged: string };
        target: { original: string; merged: string };
        anchors: { source: string; target: string };
    }>;
    superNodes: Array<[string, string]>;
    anchorGroups: Map<string, EdgeGroup>;
}

interface EdgeGroup {
    anchorId: string;
    edges: BindingEdge[];
    resolvedValue: any;
}




// Interactor schema fn 
function expandAllAnchors(edge: BindingEdge, source: BaseComponent, target: BaseComponent): BindingEdge[] {
    const getAnchors = (component: BaseComponent, anchorId: string) =>
        anchorId === '_all'
            ? [...component.getAnchors().values()].map(a => a.id.anchorId)
            : [anchorId];

    const sourceAnchors = getAnchors(source, edge.source.anchorId);
    const targetAnchors = getAnchors(target, edge.target.anchorId);

    function isCompatible(sourceAnchorId: string, targetAnchor: string) {
        return getChannelFromEncoding(sourceAnchorId) == getChannelFromEncoding(targetAnchor)
    }

    return sourceAnchors.flatMap(sourceAnchor =>
        targetAnchors
            .filter(targetAnchor => isCompatible(sourceAnchor, targetAnchor))
            .map(targetAnchor => ({
                source: { nodeId: edge.source.nodeId, anchorId: sourceAnchor },
                target: { nodeId: edge.target.nodeId, anchorId: targetAnchor }
            }))
    );
}
function expandEdges(edges: BindingEdge[]): BindingEdge[] {
    return edges.flatMap(edge => {
        const sourceComponent = BindingManager.getInstance().getComponent(edge.source.nodeId);
        if (!sourceComponent) {
            throw new Error(`Source component ${edge.source.nodeId} not found`);
        }
        const targetComponent = BindingManager.getInstance().getComponent(edge.target.nodeId);
        if (!targetComponent) {
            throw new Error(`Target component ${edge.target.nodeId} not found`);
        }
        return expandAllAnchors(edge, sourceComponent, targetComponent)
    });
}