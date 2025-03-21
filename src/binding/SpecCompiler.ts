import { BindingEdge, GraphManager, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager, VirtualBindingEdge, } from "./BindingManager";
import { compilationContext, deduplicateById, validateComponent, removeUndefinedInSpec, logComponentInfo, detectAndMergeSuperNodes, resolveAnchorValue, removeUnreferencedParams } from "./binding";
import { AnchorProxy, SchemaType, SchemaValue, RangeValue, SetValue, ScalarValue } from "../types/anchors";
import { BaseComponent } from "../components/base";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { VariableParameter } from "vega-lite/build/src/parameter";
import { TopLevelSelectionParameter } from "vega-lite/build/src/selection"
import { getChannelFromEncoding } from "../utils/anchorGeneration/rectAnchors";
import { extractConstraintsForMergedComponent, VGX_MERGED_SIGNAL_NAME } from "./mergedComponent_CLEAN";
// import { resolveCycles } from "./cycles";
import { resolveCycleMulti, expandEdges, extractAnchorType, isCompatible } from "./cycles_CLEAN";
import { pruneEdges } from "./prune";
import { Spec } from "vega-typings";
import { TopLevelParameter } from "vega-lite/build/src/spec/toplevel";
import * as vl from "vega-lite";
import * as themes from 'vega-themes';
import { mergeConfig } from 'vega';

interface AnchorEdge {
    originalEdge: BindingEdge;
    anchorProxy: AnchorProxy;
}

export type Edge = AnchorEdge | VirtualBindingEdge;
type Parameter = VariableParameter | TopLevelSelectionParameter

type AnchorId = string;
type Constraint = string;

function generateScalarConstraints(schema: SchemaType, value: SchemaValue): string {
    if(schema.valueType === 'Categorical'){
        return `${value.value}`;
    }

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
    if(schema.valueType === 'Categorical'){
        // TODO: fix this
        return `${value.value}`;
    }
    
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
        // hmm maybe there is a way we can have this become the middle position?
        value = value as ScalarValue
        return `${'VGX_SIGNAL_NAME'}+${value.value}`
    }
    return "";
}

function generateDataConstraints(schema: SchemaType, value: SchemaValue): string {
    console.log('generateDataConstraints', schema, value)
    return `${value.value}`; 
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

        console.log('bindingGraphEDGES', bindingGraph.edges)
        // expand any _all anchors to individual anchors
        const expandedEdges = expandEdges(bindingGraph.edges);

        const prunedEdges = pruneEdges(bindingGraph.nodes, expandedEdges, rootComponent.id);

        console.log('prunedEdges', prunedEdges,'expandedEdges', expandedEdges)
        // Log if node_4 is a source nodeId in any pruned or expanded edges
        console.log('node_4 as source in expandedEdges:', expandedEdges.some(edge => edge.source.nodeId === 'node_4'));
        console.log('node_4 as source in prunedEdges:', prunedEdges.some(edge => edge.source.nodeId === 'node_4'));
        
        // Additional details about node_4 edges if they exist
        const node4ExpandedEdges = expandedEdges.filter(edge => edge.source.nodeId === 'node_4');
        const node4PrunedEdges = prunedEdges.filter(edge => edge.source.nodeId === 'node_4');
        
        if (node4ExpandedEdges.length > 0) {
            console.log('node_4 expanded edges details:', node4ExpandedEdges);
        }
        
        if (node4PrunedEdges.length > 0) {
            console.log('node_4 pruned edges details:', node4PrunedEdges);
        }
        bindingGraph.edges = prunedEdges;
   
        const processedGraph = resolveCycleMulti(bindingGraph, this.getBindingManager());


        console.log('processedGraph', processedGraph)
        // Compile the updated graph
        const compiledSpecs = this.compileBindingGraph(fromComponentId, processedGraph);

        const compiltation = mergeSpecs(compiledSpecs, rootComponent.id);
        const mergedSpec = compiltation.mergedSpec;
        const accessors = compiltation.accessors;   

        //TODO stop from removing undefined with data
        const undefinedRemoved = removeUndefinedInSpec(mergedSpec);
        const unreferencedRemoved = removeUnreferencedParams(undefinedRemoved);

        const newParams = fixVegaSpanBug(unreferencedRemoved.params)
        unreferencedRemoved.params = newParams

        const sortedParams = unreferencedRemoved.params?.sort((a, b) => {
            const aEndsWithStart = a.name.endsWith('span_start_x') || a.name.endsWith('span_start_y');
            const bEndsWithStart = b.name.endsWith('span_start_x') || b.name.endsWith('span_start_y');
            
            if (aEndsWithStart && !bEndsWithStart) return 1;
            if (!aEndsWithStart && bEndsWithStart) return -1;
            return a.name.localeCompare(b.name);
        });

        undefinedRemoved.params=sortedParams

        console.log('vl spec', undefinedRemoved)

        try {

            undefinedRemoved.datasets = {}
            // Create empty array placeholders for each dataset
            accessors.forEach(accessor => {
                if (accessor && accessor.datasetName) {
                    // Initialize an empty array as placeholder for the dataset
                    undefinedRemoved.datasets[accessor.datasetName] = []
                    console.log(`Added placeholder dataset: ${accessor.datasetName}`);
                }
            });

            const vegaCompilation = vl.compile(undefinedRemoved);
            console.log('vegaCompilation', vegaCompilation)   
            // Filter out empty datasets from accessors
            // Only filter datasets that come from accessors, keep all other datasets intact
            const filteredData = vegaCompilation.spec.data?.filter(dataset => {
                // Check if this dataset is from an accessor
                const isFromAccessor = accessors.some(accessor => 
                    accessor && accessor.datasetName === dataset.name
                );
                
                // If it's from an accessor, only keep it if it has transforms with operations
                if (isFromAccessor) {
                    return dataset && 
                           dataset.transform && 
                           dataset.transform.length > 0;
                }
                
                // Keep all non-accessor datasets
                return true;
            });
            
            vegaCompilation.spec.data = filteredData;

            // Process data accessors and add them as datasets to the Vega spec
            if (accessors && accessors.length > 0) {
                // Initialize datasets array if it doesn't exist
                vegaCompilation.spec.data = vegaCompilation.spec.data || [];
                
                // Add each data accessor as a dataset
                accessors.forEach(accessor => {
                    if (accessor && accessor.datasetName) {
                        // Create a new dataset entry
                        const datasetEntry = {
                            name: accessor.datasetName,
                            source: accessor.source || 'root', // Default to root if no source specified
                            transform: accessor.transform || []
                        };
                        
                        // Add the dataset to the Vega spec
                        vegaCompilation.spec.data.push(datasetEntry);
                        
                        console.log(`Added dataset: ${accessor.datasetName} with ${datasetEntry.transform.length} transforms`);
                    }
                });
            // Add placeholder datasets for any data accessors
            vegaCompilation.spec.datasets = vegaCompilation.spec.datasets || {};
            
            }
            const existingSignals = vegaCompilation.spec.signals || [];
            existingSignals.forEach(signal => {
                if(signal.name.includes('VGXMOD_')){
    
                    // Create a copy of the signal name instead of modifying in place
                    const signalName = signal.name.substring(7); // Remove 'VGXMOD_' prefix
                    const signalUpdate = signal.on?.[0];
                    
                    // Find the corresponding signal in the vegaCompilation.spec.signals
                    const matchingSignal = existingSignals.find(s => s.name === signalName);
                    
                    // If we found a matching signal and it has an 'on' property with at least one entry
                    if (matchingSignal && matchingSignal.on && matchingSignal.on.length > 0) {
                        // Add the matching signal's first 'on' entry to the current signal's 'on' array
                        matchingSignal.on.push(signalUpdate)
                    }
                }
            })
    
    
            vegaCompilation.spec.signals = existingSignals;

            console.log("FINAL VEGA SPEC", vegaCompilation.spec)

            
            return vegaCompilation;
        } catch (error) {
            console.log('error', error)
            return undefined
        }   
       
    }


    private buildImplicitContextEdges(node: BindingNode, previousEdges: BindingEdge[], nodes: BindingNode[]): BindingEdge[]{
        let edges = [...previousEdges]

        // Skip if this is a merged node
        if (node.type === 'merged') {
            return [];
        }

        // 1. Find all parent nodes (nodes that have edges targeting the current node)
        const parentNodes = nodes.filter(n => 
            edges.some(edge => edge.source.nodeId === n.id && edge.target.nodeId === node.id)
        );

        console.log('parentNodes for', parentNodes, 'for', node.id)
        
        if (parentNodes.length === 0) return [];
        
        // Get the current component
        const component = this.getBindingManager().getComponent(node.id);
        if (!component) return [];
        
        // Map to store the highest value anchor for each channel type
        const highestAnchors: Record<string, { nodeId: string, anchorId: string, value: number }> = {};
        
        // 2. For each parent, find default configuration and compatible anchors
        for (const parentNode of parentNodes) {
            console.log('parentNode', parentNode, parentNodes)
            // Skip merged nodes
            if (parentNode.type === 'merged') continue;
            
            const parentComponent = this.getBindingManager().getComponent(parentNode.id);
            if (!parentComponent) continue;
            
            // Find default configuration for parent
            const defaultConfigKey = Object.keys(parentComponent.configurations || {})
                .find(cfg => parentComponent.configurations[cfg]?.default);

            
            if (!defaultConfigKey) continue;
            
            // Get all anchors for this parent
            const parentAnchors = parentComponent.getAnchors();
            console.log('parentAnchors', parentAnchors)
            // Process each anchor
            parentAnchors.forEach(anchor => {
                const anchorId = anchor.id.anchorId;
                const channel = extractAnchorType(anchorId);
                console.log('anchorId', anchorId, channel)
                if (!channel) return;
                
                // Extract numeric value from anchor ID if present (e.g., "node_5_x" -> 5)
                const match = anchorId.match(/node_(\d+)_/);
                const value = match ? parseInt(match[1], 10) : 0;
                
                // Update highest anchor for this channel if this one is higher
                if (!highestAnchors[channel] || value > highestAnchors[channel].value) {
                    highestAnchors[channel] = {
                        nodeId: parentNode.id,
                        anchorId,
                        value
                    };
                }
            })
        }
        console.log('highestAnchors', highestAnchors)
        // 3. Create implicit edges from highest parent anchors to this node
        for (const [channel, anchorInfo] of Object.entries(highestAnchors)) {
            // Find compatible target anchor on current node
            const targetAnchors = component.getAnchors()
                .filter(anchor => {
                    const targetChannel = extractAnchorType(anchor.id.anchorId);
                    return targetChannel && isCompatible(channel, targetChannel);
                });
            
            if (targetAnchors.length === 0) continue;
            
            // Create implicit edge
            const implicitEdge: BindingEdge = {
                source: {
                    nodeId: anchorInfo.nodeId,
                    anchorId: anchorInfo.anchorId
                },
                target: {
                    nodeId: node.id,
                    anchorId: targetAnchors[0].id.anchorId
                },
                implicit: true
            };
                   
            // Add to implicit edges
            edges.push(implicitEdge);
        }
        
       
        return edges;
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
        let { nodes, edges } = bindingGraph;
        console.log('FIRST edges', edges,'nodes', nodes)
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


            console.log('ALLedges', edges)
            const implicitEdges = this.buildImplicitContextEdges(node, edges, nodes);
            edges = [...edges, ...implicitEdges]
            // Build constraints for this node
            console.log('building constraints for', nodeId, 'edges', edges, 'nodes', nodes)

            // Log edges that have node_4 as source or target
            edges.forEach(edge => {
                if (edge.source.nodeId === 'node_4' || edge.target.nodeId === 'node_4') {
                    console.log('Edge with node_4:', edge);
                }
            });
            // Log edges that have 'data' in their names (case insensitive)
           
            const constraints = this.buildNodeConstraints(node, edges, nodes);

            console.log('constraints32', constraints, 'for', nodeId,node)
            
            // Store constraints for later use by merged nodes
            constraintsByNode[nodeId] = constraints;
            // Compile the current component
            const compiledNode = component.compileComponent(constraints);

            // Find and traverse child nodes
            const childNodeIds = this.findChildNodes(node, edges, nodes);
            const childSpecs = childNodeIds.flatMap(childId => traverseGraph(childId));
            // Find and traverse parent nodes
            const parentNodeIds = this.findParentNodes(node, edges, nodes);
            console.log('parentNodes', parentNodeIds, node,nodes)
            const parentSpecs = parentNodeIds.flatMap(parentId => {
                // Skip if already visited to prevent infinite loops
                if (visitedNodes.has(parentId)) {
                    return [];
                }
                console.log('finding parent', parentId)
                return traverseGraph(parentId);
            });
            
            // Combine child and parent specs
            const allRelatedSpecs = [...childSpecs, ...parentSpecs];

            // Skip merged nodes during first traversal - we'll process them separately
            if (mergedNodeIds.has(nodeId)) {
                return allRelatedSpecs;
            }

            return [compiledNode, ...allRelatedSpecs];
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
        currentNodeSchema: any,
        parentNodeSchema: any,
        anchorProxy: AnchorProxy
    ): void {

        const anchorAccessor = anchorProxy.compile();
        // Handle special case for absolute values
        if ('absoluteValue' in anchorAccessor) {
            constraints[targetAnchorId] = [anchorAccessor.absoluteValue];
            return;
        }

        // Add constraints based on container type
        if (currentNodeSchema.container === "Scalar") {
            constraints[targetAnchorId].push(
                generateScalarConstraints(parentNodeSchema, anchorAccessor)
            );
        } else if (currentNodeSchema.container === "Range") {
            constraints[targetAnchorId].push(
                generateRangeConstraints(parentNodeSchema, anchorAccessor)
            );
        } else if (currentNodeSchema.container === "Data") {
            console.log('data constraints', parentNodeSchema, anchorAccessor)
            
                constraints[targetAnchorId].push(
                    generateDataConstraints(parentNodeSchema, anchorAccessor)
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

        // console.log('parentEdges', parentEdges, 'for', node.id)
        // // Initialize data edges array to track data bindings
        // const dataEdges = parentEdges.filter(edge => {
        //     const targetComponent = this.getBindingManager().getComponent(edge.target.nodeId);
        //     if (!targetComponent) return false;
            
        //     const targetAnchorId = edge.target.anchorId;
        //     const cleanTargetId = targetAnchorId.replace('_internal', '');
        //     const schema = targetComponent.schema[cleanTargetId];
            
        //     return schema && schema.container === 'Data';
        // });

        // console.log('dataEdges', dataEdges)
        
        // // Log data edges for debugging
        // if (dataEdges.length > 0) {
        //     console.log('Data edges for component', node.id, ':', dataEdges.map(edge => ({
        //         source: `${edge.source.nodeId}.${edge.source.anchorId}`,
        //         target: `${edge.target.nodeId}.${edge.target.anchorId}`
        //     })));
        // }

        // Process each parent edge
        for (const parentEdge of parentEdges) {
            
           

            const parentNode = allNodes.find(n => n.id === parentEdge.source.nodeId);
            if(!parentNode) continue;
            
            const parentComponent = this.getBindingManager().getComponent(parentNode.id);
            if(!parentComponent) continue;

            const anchorProxy = parentComponent.getAnchor(parentEdge.source.anchorId);
            if(!anchorProxy) continue;
            
            



            // Get the schema and value from the parent anchor
            const targetAnchorId = parentEdge.target.anchorId;
            const targetAnchorSchema = component.schema[targetAnchorId];

            const cleanTargetId = targetAnchorId.replace('_internal', '');

            const currentNodeSchema = component.schema[cleanTargetId]
            console.log('currentNodeSchema', currentNodeSchema, parentEdge.source.nodeId, parentEdge.source.anchorId)
            const parentNodeSchema = anchorProxy.anchorSchema[parentEdge.source.anchorId];
            
            // Skip if no schema exists for this channel
            if (!currentNodeSchema) continue;

            // Initialize constraint array if needed
            if (!constraints[targetAnchorId]) {
                constraints[targetAnchorId] = [];
            }
            if (parentNode.id === 'node_4') {
                console.log('adding constraint for', targetAnchorId,constraints, currentNodeSchema, parentNodeSchema, anchorProxy);
            }
            // Add appropriate constraint based on component schema type
            this.addConstraintForChannel(
                constraints,
                targetAnchorId,
                currentNodeSchema,
                parentNodeSchema,
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

    private findParentNodes(
        node: BindingNode,
        edges: BindingEdge[],
        allNodes: BindingNode[]
    ): string[] {
        // Find edges where this node is the target
        const parentEdges = edges.filter(edge => edge.target.nodeId === node.id);

        // Extract unique parent node IDs
        return Array.from(new Set(
            parentEdges
                .map(edge => edge.source.nodeId)
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



function mergeSpecs(specs: Partial<UnitSpec<Field>>[], rootComponentId: string): { mergedSpec: TopLevelSpec, accessors: any[] } {
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

    // Extract any dataAccessor properties and remove them from the spec
    const extractDataAccessors = (obj: any, path: string = '', accessors: any[] = []) => {
        if (!obj || typeof obj !== 'object') return accessors;

        // Check if the current object has a dataAccessor property
        if ('dataAccessor' in obj) {
            console.log(`Found dataAccessor at ${path}:`, obj.dataAccessor);
            accessors.push(obj.dataAccessor);
            delete obj.dataAccessor;
        }

        // Recursively check all properties
        Object.entries(obj).forEach(([key, value]) => {
            const newPath = path ? `${path}.${key}` : key;
            extractDataAccessors(value, newPath, accessors);
        });

        return accessors;
    };

    // Apply the extraction to the merged spec
    const accessors = extractDataAccessors(mergedSpec);

    return { mergedSpec, accessors };
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



/*

 Temporary fix for the issue where start span parameters don't seem to update?
 Looks like it isn't detecting changing with node_start, and thus it doesn't update it, even when 
 a new drag occurs. 

*/
function fixVegaSpanBug(params: TopLevelParameter[]) :TopLevelParameter[]{
    for (let i = 0; i < params.length; i++) {
        const param = params[i];
        
        
        // Check if this is a span start parameter for any dimension (x or y)
        if (param.name.endsWith('_x_start') || param.name.endsWith('_y_start') || 
            param.name.endsWith('begin_x') || param.name.endsWith('begin_y')) {
         
            // Extract the dimension from the parameter name
            let dimension, startType;
            
            if (param.name.endsWith('_x_start') || param.name.endsWith('_y_start')) {
                dimension = param.name.endsWith('_x_start') ? 'x' : 'y';
                startType = 'start';
            } else if (param.name.endsWith('_begin_x') || param.name.endsWith('_begin_y')) {
                dimension = param.name.endsWith('_begin_x') ? 'x' : 'y';
                startType = 'begin';
            } else {
                // Fallback to extracting channel if the pattern doesn't match
                const channel = extractAnchorType(param.name);
                dimension = channel === 'x' ? 'x' : 'y';
                startType = param.name.includes('_start') ? 'start' : 'begin';
            }

            const baseName = startType === 'start' ? 
                param.name.split(`_${dimension}_start`)[0] : 
                param.name.split(`_begin_${dimension}`)[0];
            
            // Find the corresponding stop parameter
            const stopParamName = baseName + (startType === 'start' ? `_${dimension}_stop` : `_point_${dimension}`);
            // Find the corresponding stop parameter
            // const stopParamName = `${nodeId}_span_${dimension}_stop`;
            
            // Ensure the param has an 'on' array
            if (!param.on) {
                param.on = [];
            }
            
            // If there's already an event handler, add to it
            if (param.on.length > 0) {
                // Add the stop parameter to the events if it's not already there
                if (!param.on[0].events.signal || !param.on[0].events.signal.includes(stopParamName)) {
                    if (!Array.isArray(param.on[0].events)) {
                        const pastObject = param.on[0].events;

                        param.on[0].events = [ { signal: stopParamName }];
                        if (pastObject) {
                            param.on[0].events.push(pastObject);
                        }
                        
                    } else {
                        param.on[0].events.push({signal:stopParamName});

                       
                    }
                }
            } else {
                // A scale parameter doesn't have an on array
                // // Create a new event handler
                // param.on.push({
                //     events: { signal: stopParamName },
                //     update: param.update || param.value
                // });
            }
        }
    }
    return params;
}