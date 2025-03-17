import { BindingEdge, GraphManager, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager, VirtualBindingEdge, } from "./BindingManager";
import { compilationContext, deduplicateById, validateComponent, removeUndefinedInSpec, logComponentInfo, detectAndMergeSuperNodes, resolveAnchorValue } from "./binding";
import { AnchorProxy, SchemaType, SchemaValue, RangeValue, SetValue, ScalarValue } from "../types/anchors";
import { BaseComponent } from "../components/base";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { VariableParameter } from "vega-lite/build/src/parameter";
import { TopLevelSelectionParameter } from "vega-lite/build/src/selection"
import { getChannelFromEncoding } from "../utils/anchorGeneration/rectAnchors";
import { extractConstraintsForMergedComponent, VGX_MERGED_SIGNAL_NAME } from "./mergedComponent_CLEAN";
// import { resolveCycles } from "./cycles";
import { resolveCycles, expandEdges } from "./cycles_CLEAN";
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
        return `clamp(${'VGX_SIGNAL_NAME'},${value.value},${value.value})`
    }
    return "";
}

// 
function generateRangeConstraints(schema: SchemaType, value: SchemaValue): string {
    if (schema.container === 'Range') {
        //TODO SOMETHING WEIRD IS HAPPIGN HERE WHERE RECT IS GIVING WEIRD UPDATES TO THIS
        value = value as RangeValue

        // range:range, means start=start, stop=stop
        // return `nearest(${'VGX_SIGNAL_NAME'},[${value.start},${value.stop}])`
        return `clamp(${'VGX_SIGNAL_NAME'},${value.start},${value.stop})`
    }
    if (schema.container === 'Set') {
        value = value as SetValue
        return `nearest(${'VGX_SIGNAL_NAME'},${value.values})`
    }
    if (schema.container === 'Scalar') {
        // !!!!!!!!! NOTE THIS IS DIFF THAN SCALAR CODE AS WE OFFSET instead of share !!!!!!!!!
        value = value as ScalarValue
        return `${'VGX_SIGNAL_NAME'}+${value.value}`
    }
    return "";
}


// The goal of the spec compiler is to take in a binding graph and then compute
export class SpecCompiler {
    constructor(
        private graphManager: GraphManager,
        private getBindingManager: () => BindingManager // Getter for BindingManager
    ) { }

    public compile(fromComponentId: string): TopLevelSpec {
        const rootComponent = this.getBindingManager().getComponent(fromComponentId);
        if (!rootComponent) {
            throw new Error(`Component "${fromComponentId}" not found.`);
        }
        console.log('rootComponent', this.graphManager)

        // specific binding graph for this tree
        let bindingGraph = this.graphManager.generateBindingGraph(rootComponent.id);
        console.log('initial bindingGraph', JSON.parse(JSON.stringify(bindingGraph)))
        // expand any _all anchors to individual anchors
        const expandedEdges = expandEdges(bindingGraph.edges);

        //TODO prune edges that were made from other configs that are not necessary
        
        bindingGraph.edges = expandedEdges;
        console.log('expanded bindingGraph', JSON.parse(JSON.stringify(bindingGraph)))
        const processedGraph = resolveCycles(bindingGraph, this.getBindingManager());

        console.log('processedGraph', processedGraph)

        // Compile the updated graph
        const compiledSpecs = this.compileBindingGraph(fromComponentId, processedGraph);

        //const compiledSpecs = this.compileBindingGraph(bindingGraph);
        const mergedSpec = mergeSpecs(compiledSpecs, rootComponent.id);

        return removeUndefinedInSpec(mergedSpec);
    }

    /**
     * Compiles a binding graph into a collection of Vega-Lite specifications.
     * This is the core function that traverses the processed graph and compiles
     * each component while respecting their constraints.
     * 
     * @param rootId ID of the root component to start traversal from
     * @param bindingGraph The processed binding graph with cycles resolved
     * @returns Array of compiled Vega-Lite specifications
     */
    private compileBindingGraph(rootId: string, bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        const { nodes, edges } = bindingGraph;
        console.log('esdffsddges', edges)
        const visitedNodes = new Set<string>();
        const constraintsByNode: Record<string, Record<string, any[]>> = {};
        const mergedNodeIds = new Set<string>();

        // Find all merged nodes for special handling
        nodes.forEach((node) => {
            if (node.type === 'merged') {
                mergedNodeIds.add(node.id);
            }
        });

        /**
         * Main pre-order traversal function
         */
        const traverseGraph = (nodeId: string): Partial<UnitSpec<Field>>[] => {
            // Skip if already visited
            if (visitedNodes.has(nodeId)) {
                return [];
            }
            visitedNodes.add(nodeId);

            // Get the node and component
            const node = nodes.find(n => n.id === nodeId);
            if (!node) {
                console.warn(`Node ${nodeId} not found in binding graph`);
                return [];
            }

            const component = this.getBindingManager().getComponent(nodeId);
            if (!component) {
                console.warn(`Component ${nodeId} not found`);
                return [];
            }


            // Build constraints for this node
            const constraints = this.buildNodeConstraints(node, edges, nodes);
            // Store constraints for later use by merged nodes
            constraintsByNode[nodeId] = constraints;



            console.log('constraints', constraints, component)
            // Compile the current component
            const compiledNode = component.compileComponent(constraints);

            // Find and traverse child nodes
            const childNodeIds = this.findChildNodes(node, edges, nodes);
            const childSpecs = childNodeIds.flatMap(childId => traverseGraph(childId));

            // Skip merged nodes during first traversal - we'll process them separately
            if (mergedNodeIds.has(nodeId)) {
                return [...childSpecs];
            }

            return [compiledNode, ...childSpecs];
        };

        // First pass: Traverse the graph starting from the root
        const regularSpecs = traverseGraph(rootId);

        // Now process all merged nodes after the regular traversal is complete
        const mergedSpecs = Array.from(mergedNodeIds).map(nodeId => {
            const component = this.getBindingManager().getComponent(nodeId);

            // Find all edges where this node is the target
            const parentEdges = edges.filter(edge => edge.target.nodeId === nodeId);
            const parentEdgePairs = parentEdges.map(edge => {
                const parentNode = nodes.find(n => n.id === edge.source.nodeId);
                return parentNode ? { edge, node: parentNode } : null;
            }).filter((pair): pair is { edge: BindingEdge, node: BindingNode } => pair !== null);

            const parentAnchors = parentEdgePairs.map(({ edge, node }) => {
                const parentComponent = this.getBindingManager().getComponent(node.id);
                if (!parentComponent) return undefined;
                const anchor = parentComponent.getAnchor(edge.source.anchorId);
                return { anchor, targetId: edge.target.anchorId };
            }).filter((anchor): anchor is { anchor: AnchorProxy, targetId: string } => anchor !== undefined);

            // console.log('parentAnchors:::', parentAnchors, JSON.parse(JSON.stringify(compileConstraints)), component)
            // Extract constraints for merged component
            const mergedSignals = extractConstraintsForMergedComponent(parentAnchors, constraintsByNode, component);
            const constraints: Record<AnchorId, Constraint[]> = {
                ['VGX_MERGED_SIGNAL_NAME']: mergedSignals
            };

            // Compile the merged component with its constraints
            return component.compileComponent(constraints);
        });

        // Second pass: Process merged nodes
        // const mergedSpecs = this.compileMergedNodes(mergedNodeIds, constraintsByNode);

        // Combine and return all specs
        return [...regularSpecs, ...mergedSpecs];
    }


    /**
     * Add appropriate constraint based on channel schema type
     */
    private addConstraintForChannel(
        constraints: Record<AnchorId, Constraint[]>,
        targetAnchorId: string,
        cleanTargetId: string,
        channelSchema: any,
        anchorProxy: AnchorProxy
    ): void {
        const schema = anchorProxy.anchorSchema[cleanTargetId];
        const anchorAccessor = anchorProxy.compile();
        console.log('anchorAccessor', anchorAccessor)
        // Handle special case for absolute values
        if ('absoluteValue' in anchorAccessor) {
            constraints[targetAnchorId] = [anchorAccessor.absoluteValue];
            return;
        }

        // Add constraints based on container type
        if (channelSchema.container === "Scalar") {
            constraints[targetAnchorId].push(
                generateScalarConstraints(channelSchema, anchorAccessor)
            );
        } else if (channelSchema.container === "Range") {
            constraints[targetAnchorId].push(
                generateRangeConstraints(channelSchema, anchorAccessor)
            );
        }
    }
    /**
     * Build constraint objects from parent nodes
     */
    private buildNodeConstraints(
        node: BindingNode,
        edges: BindingEdge[],
        allNodes: BindingNode[]
    ): Record<AnchorId, Constraint[]> {
        const component = this.getBindingManager().getComponent(node.id);
        if (!component) return {};

        // Find parent edges and nodes
        const parentEdges = edges.filter(edge => edge.target.nodeId === node.id);
        const constraints: Record<AnchorId, Constraint[]> = {};

        // Process each parent edge
        for (const parentEdge of parentEdges) {
            console.log('parentEdge', parentEdge)
            const parentNode = allNodes.find(n => n.id === parentEdge.source.nodeId);
            if (!parentNode) continue;

            const parentComponent = this.getBindingManager().getComponent(parentNode.id);
            if (!parentComponent) continue;

            const anchorProxy = parentComponent.getAnchor(parentEdge.source.anchorId);
            if (!anchorProxy) continue;



            // Get the schema and value from the parent anchor
            const targetAnchorId = parentEdge.target.anchorId;
            const targetAnchorSchema = component.schema[targetAnchorId];

            console.log('targetAncdasdashorId', component,targetAnchorId, component.schema,targetAnchorSchema)
            const cleanTargetId = targetAnchorId.replace('_internal', '');

            // Skip if no schema exists for this channel
            if (!component.schema[cleanTargetId]) continue;

            // Initialize constraint array if needed
            if (!constraints[targetAnchorId]) {
                constraints[targetAnchorId] = [];
            }

            console.log('inputs:', constraints, targetAnchorId, cleanTargetId, targetAnchorSchema, anchorProxy)

            // Add appropriate constraint based on component schema type
            this.addConstraintForChannel(
                constraints,
                targetAnchorId,
                cleanTargetId,
                targetAnchorSchema,
                anchorProxy
            );
        }

        return constraints;
    }

    /**
     * Find child nodes for a given node
     */
    private findChildNodes(
        node: BindingNode,
        edges: BindingEdge[],
        allNodes: BindingNode[]
    ): string[] {
        // Find edges where this node is the source
        const childEdges = edges.filter(edge => edge.source.nodeId === node.id);

        // Extract unique child node IDs
        return Array.from(new Set(
            childEdges
                .map(edge => edge.target.nodeId)
                .filter(id => allNodes.find(n => n.id === id))
        ));
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



