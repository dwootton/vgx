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
import { extractConstraintsForMergedComponent, MERGED_SIGNAL_NAME } from "./mergedComponent";
import { resolveCycles } from "./cycles";

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
        return `nearest(${'VGX_SIGNAL_NAME'},[${value.start},${value.stop}])`
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

        // specific binding graph for this tree
        let bindingGraph = this.graphManager.generateBindingGraph(rootComponent.id);

        // Compile the updated graph
        const compiledSpecs = this.compileBindingGraph(fromComponentId, bindingGraph);

        //const compiledSpecs = this.compileBindingGraph(bindingGraph);
        const mergedSpec = mergeSpecs(compiledSpecs, rootComponent.id);

        return removeUndefinedInSpec(mergedSpec);
    }



    private compileBindingGraph(rootId: string, bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        // const { nodes, edges } = bindingGraph;


        let edges = expandEdges(bindingGraph.edges);
        let nodes = new Map(bindingGraph.nodes);

        const cycles = findCycles(new Map(bindingGraph.nodes), [...edges]);


        for (const cycle of cycles) {
            // for each cycle, we need to create a new merged component node and then swap the edges to point to the new node


            // Resolve cycles by creating merged nodes
            const resolvedGraph = resolveCycles(edges, nodes, cycle.nodes, cycle.edges, this.getBindingManager());

            nodes = new Map(resolvedGraph.nodes);
            edges = resolvedGraph.edges;
        }


        type ComponentId = string;
        const compileConstraints: Record<ComponentId, Record<AnchorId, Constraint[]>> = {}

        const preOrderTraversal = (
            node: BindingNode,
            edges: BindingEdge[],
            visitedNodes = new Set<string>(),
            mergedNodes: BindingNode[] = []
        ): Partial<UnitSpec<Field>>[] => {
            // If this node has already been processed, skip it
            if (visitedNodes.has(node.id)) {
                console.log('visitedNodes', visitedNodes)
                return [];
            }

            // Mark this node as visited
            visitedNodes.add(node.id);

            // Get the component for the current node
            const component = this.getBindingManager().getComponent(node.id);

            // If this is a merged component, add it to the list to process later
            if ('mergedComponent' in component && component.mergedComponent === true) {
                mergedNodes.push(node);
                return []; // Skip processing for now
            }

            // Find all edges where this node is the target
            const parentEdges = edges.filter(edge => edge.target.nodeId === node.id);

            // Create a list of {edge, node} pairs to preserve the relationship between edges and nodes
            const parentEdgePairs = parentEdges.map(edge => {
                const parentNode = nodes.get(edge.source.nodeId);
                return parentNode ? { edge, node: parentNode } : null;
            }).filter((pair): pair is { edge: BindingEdge, node: BindingNode } => pair !== null);

            // Extract parent anchors from the edge-node pairs
            const parentAnchors = parentEdgePairs.map(({ edge, node }) => {
                const parentComponent = this.getBindingManager().getComponent(node.id);
                if (!parentComponent) return undefined;

                // Get the anchor from the parent component using the source anchorId from the edge
                const anchor = parentComponent.getAnchor(edge.source.anchorId);

                return { anchor, targetId: edge.target.anchorId };
            }).filter((anchor): anchor is { anchor: AnchorProxy, targetId: string } => anchor !== undefined);

            const constraints: Record<AnchorId, Constraint[]> = {};
            const absoluteConstraints: Record<AnchorId, Constraint[]> = {};

            // for each parent anchor, create what constraints it places on the component
            parentAnchors.forEach(({ anchor, targetId }) => {
                const anchorProxy = anchor;
                console.log('targeting', targetId);

                const cleanTargetId = targetId.replace('_internal', '');
                const parentSchema = anchorProxy.anchorSchema[cleanTargetId];
                const parentAnchorAccessor = anchorProxy.compile();

                console.log('cleanTargetId', cleanTargetId, targetId);
                // Skip channels not present in component schema
                if (!component.schema[cleanTargetId]) {
                    console.log('noschemafor', cleanTargetId);
                    return;
                }

                // using targetId as we want _x for the schema type, but _x_internal for the separate signal
                if (!constraints[targetId]) {
                    constraints[targetId] = [];
                }

                if (component.schema[cleanTargetId].container === "Scalar") {
                    if ('absoluteValue' in parentAnchorAccessor) {
                        console.log('setting absolute constraint', parentAnchorAccessor.absoluteValue);
                        absoluteConstraints[targetId] = [parentAnchorAccessor.absoluteValue]; // only constraint
                        return;
                    }
                    constraints[targetId].push(generateScalarConstraints(parentSchema, parentAnchorAccessor));
                } else if (component.schema[cleanTargetId].container === "Range") {
                    constraints[targetId].push(generateRangeConstraints(parentSchema, parentAnchorAccessor));
                }
            });

            //overwrite constraints with absolute constraints
            Object.keys(absoluteConstraints).forEach(channel => {
                console.log('overwritting', JSON.parse(JSON.stringify(constraints[channel])), 'all constraints',JSON.parse(JSON.stringify(constraints)));
                constraints[channel] = absoluteConstraints[channel];
                console.log('setting absolute constraint', absoluteConstraints[channel]);
            });

            compileConstraints[component.id] = constraints;

            // Compile the current node with the context
            const compiledNode = component.compileComponent(constraints);

            // Find child nodes from edges where this node is the source
            const childEdges = edges.filter(edge => edge.source.nodeId === node.id);
            const childNodes = childEdges.map(edge =>
                nodes.get(edge.target.nodeId)
            ).filter((n): n is BindingNode => n !== undefined);

            // Recursively process child nodes
            const children = childNodes.map(child =>
                preOrderTraversal(child, edges, visitedNodes, mergedNodes)  // Pass the merged nodes list
            );

            // Flatten the results
            return [compiledNode, ...children.flat()];
        };

        // Start traversal with an empty visited set and empty merged nodes list
        const mergedNodes: BindingNode[] = [];
        const compiledComponents = preOrderTraversal(nodes.get(rootId)!, edges, new Set<string>(), mergedNodes);

        console.log('mergedNodes', JSON.parse(JSON.stringify(mergedNodes)))
        // Now process all merged nodes after the regular traversal is complete
        const mergedComponents = mergedNodes.map(node => {
            const component = this.getBindingManager().getComponent(node.id);
            
            // Find all edges where this node is the target
            const parentEdges = edges.filter(edge => edge.target.nodeId === node.id);
            const parentEdgePairs = parentEdges.map(edge => {
                const parentNode = nodes.get(edge.source.nodeId);
                return parentNode ? { edge, node: parentNode } : null;
            }).filter((pair): pair is { edge: BindingEdge, node: BindingNode } => pair !== null);

            const parentAnchors = parentEdgePairs.map(({ edge, node }) => {
                const parentComponent = this.getBindingManager().getComponent(node.id);
                if (!parentComponent) return undefined;
                const anchor = parentComponent.getAnchor(edge.source.anchorId);
                return { anchor, targetId: edge.target.anchorId };
            }).filter((anchor): anchor is { anchor: AnchorProxy, targetId: string } => anchor !== undefined);

            console.log('parentAnchors:::', parentAnchors, JSON.parse(JSON.stringify(compileConstraints)), component)
            // Extract constraints for merged component
            const mergedSignals = extractConstraintsForMergedComponent(parentAnchors, compileConstraints, component);
            const constraints: Record<AnchorId, Constraint[]> = {
                [MERGED_SIGNAL_NAME]: mergedSignals
            };

            // Compile the merged component with its constraints
            return component.compileComponent(constraints);
        });

        return [...compiledComponents, ...mergedComponents];
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
    }).filter(e => e.source.anchorId !== '_all' || e.target.anchorId !== '_all');;
}

// we need to check for cycles here, and if there are cycles, we need to add super nodes
// This version partitions the graph by anchor ID and detects cycles within each partition
function findCycles(nodes: Map<string, BindingNode>, edges: BindingEdge[]): { nodes: Set<string>, edges: BindingEdge[] }[] {
    const allCycles: Array<{ nodes: Set<string>, edges: BindingEdge[] }> = [];

    console.log('edges', edges, 'nodes', nodes);

    // Group edges by anchor ID
    const edgesByAnchor = new Map<string, BindingEdge[]>();

    // Extract all unique anchor IDs from edges
    const anchorIds = new Set<string>();
    edges.forEach(edge => {
        // We assume that in a valid edge, source and target anchors are of the same type
        anchorIds.add(edge.source.anchorId);
    });

    // Partition edges by anchor ID
    anchorIds.forEach(anchorId => {
        const filteredEdges = edges.filter(edge =>
            edge.source.anchorId === anchorId && edge.target.anchorId === anchorId
        );
        edgesByAnchor.set(anchorId, filteredEdges);
    });

    // For each anchor partition, find cycles
    edgesByAnchor.forEach((partitionEdges, anchorId) => {
        if (partitionEdges.length === 0) return;

        // Standard DFS cycle detection for each partition
        const visited = new Set<string>();
        const inStack = new Set<string>();
        const pathMap = new Map<string, { prev: string, edge: BindingEdge }>();

        function dfs(nodeId: string): boolean {
            if (inStack.has(nodeId)) {
                // Found a cycle, reconstruct it
                const cycleNodeIds = new Set<string>();
                const cycleEdgesList: BindingEdge[] = [];

                // Start from the current node
                let currentNode = nodeId;
                let startNode = nodeId;

                // Reconstruct the cycle path
                do {
                    const pathInfo = pathMap.get(currentNode);
                    if (!pathInfo) break;

                    cycleNodeIds.add(currentNode);
                    cycleEdgesList.unshift(pathInfo.edge);
                    currentNode = pathInfo.prev;
                } while (currentNode !== startNode);

                // Add the start node to complete the cycle
                cycleNodeIds.add(startNode);

                // Verify that the cycle has exactly 2 nodes and 2 edges
                if (cycleNodeIds.size !== 2 || cycleEdgesList.length !== 2) {
                    throw new Error(`Cycles must have exactly 2 nodes and 2 edges. Found cycle with ${cycleNodeIds.size} nodes and ${cycleEdgesList.length} edges.`);
                }

                // Record this cycle
                allCycles.push({
                    nodes: cycleNodeIds,
                    edges: cycleEdgesList
                });

                return true;
            }

            if (visited.has(nodeId)) {
                return false;
            }

            visited.add(nodeId);
            inStack.add(nodeId);

            // Find all outgoing edges from this node in the current partition
            const outgoingEdges = partitionEdges.filter(edge => edge.source.nodeId === nodeId);

            for (const edge of outgoingEdges) {
                const nextNodeId = edge.target.nodeId;

                // Record the path
                pathMap.set(nextNodeId, { prev: nodeId, edge: edge });

                if (dfs(nextNodeId)) {
                    return true;
                }
            }

            inStack.delete(nodeId);
            return false;
        }

        // Start DFS from each node in this partition
        const partitionNodes = new Set<string>();
        partitionEdges.forEach(edge => {
            partitionNodes.add(edge.source.nodeId);
            partitionNodes.add(edge.target.nodeId);
        });

        partitionNodes.forEach(nodeId => {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        });
    });

    console.log('Found cycles:', allCycles);
    return allCycles;
}
