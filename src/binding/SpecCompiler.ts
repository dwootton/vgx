import { BindingEdge, GraphManager, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager, VirtualBindingEdge, } from "./BindingManager";
import { AnchorProxy, SchemaType, SchemaValue, RangeValue, SetValue, ScalarValue, AnchorType } from "../types/anchors";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { extractConstraintsForMergedComponent } from "./mergedComponent";
import { extractAnchorType, isAnchorTypeCompatible } from "./cycles";
import { VegaPatchManager } from "../compilation/VegaPatchManager";
import { mergeSpecs } from "./utils";
import { createConstraintFromSchema } from "./constraints";
import { mergeConstraints } from "../components/utils";
import { BaseComponent } from "components/base";

interface AnchorEdge {
    originalEdge: BindingEdge;
    anchorProxy: AnchorProxy;
}

export type Edge = AnchorEdge | VirtualBindingEdge;

type AnchorId = string;
type Constraint = string;

function generateScalarConstraints(schema: SchemaType, value: SchemaValue): string {
    if (schema.container === 'Absolute') {
        return `${value.value}`;
    }
    if (schema.container === 'Data') {
        return `datum[${value.value}]`;
    }
    if (schema.valueType === 'Categorical') {

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

function getAnchorSafely(component: BaseComponent, anchorId: string): AnchorProxy | null {
    try {
        return component.getAnchor(anchorId);
    } catch {
        return null;
    }
}

function generateRangeConstraints(schema: SchemaType, value: SchemaValue): string {
    if (schema.container === 'Absolute') {
        console.
            return`${value.value}`;
    }

    if (schema.valueType === 'Categorical') {
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
    return `${value.value}`;
}


// The goal of the spec compiler is to take in a binding graph and then compute
export class SpecCompiler {
    constructor(
        private graphManager: GraphManager,
        private getBindingManager: () => BindingManager // Getter for BindingManager
    ) { }


    public compile(fromComponentId: string): TopLevelSpec {

        const elaboratedGraph = this.graphManager.buildCompilationGraph(fromComponentId);

        const compiledSpecs = this.compileBindingGraph(elaboratedGraph);

        const mergedSpec = mergeSpecs(compiledSpecs, fromComponentId);


        const patchManager = new VegaPatchManager(mergedSpec);


        return patchManager.compile();

    }


    private buildImplicitContextEdges(node: BindingNode, previousEdges: BindingEdge[], nodes: BindingNode[],): BindingEdge[] {
        let edges = [...previousEdges]
        const implicitEdges = []

        console.log('buildImplicitContextEdgesfor:', node, previousEdges, nodes)
        // Skip if this is a merged node
        if (node.type === 'merged') {
            return [];
        }

        // 1. Find all parent nodes (nodes that have edges targeting the current node)
        const parentNodes = nodes.filter(n =>
            edges.some(edge => edge.source.nodeId === n.id && edge.target.nodeId === node.id)
        );

        // Extract other nodes from merged node IDs
        // For merged nodes like 'merged_node_2_node_3_node_1', extract [node_2, node_3] if current node is node_1
        const extractOtherNodesFromMergedId = (mergedId: string, currentNodeId: string): string[] => {
            // Check if this is a merged node ID
            if (!mergedId.startsWith('merged_')) {
                return [];
            }
            
            // Split the merged ID into parts
            const parts = mergedId.split('_');
            
            // Remove 'merged' prefix
            parts.shift();
            
            // Filter out the current node ID and return the remaining node IDs
            return parts.filter(part => {
                // Handle case where the node ID might be multi-part (e.g., "node_1")
                return !currentNodeId.endsWith(part) && !currentNodeId.includes(`${part}_`);
            }).map(part => {
                // If the part is just a number, prepend "node_" to it
                if (/^\d+$/.test(part)) {
                    return `node_${part}`;
                }
                return part;
            });
        };
        
        // Add merged nodes to parent nodes if they contain the current node
        nodes.forEach(potentialMergedNode => {
            if (potentialMergedNode.type === 'merged' && potentialMergedNode.id.includes(node.id)) {
                const otherNodeIds = extractOtherNodesFromMergedId(potentialMergedNode.id, node.id);
                
                // Find the actual node objects for these IDs
                const otherNodes = nodes.filter(n => otherNodeIds.includes(n.id));
                
                // Add these nodes to parent nodes if they're not already there
                otherNodes.forEach(otherNode => {
                    if (!parentNodes.some(pn => pn.id === otherNode.id)) {
                        parentNodes.push(otherNode);
                    }
                });
            }
        });
        if (node.id === 'node_1') {
            console.log('parentNodes for node_1:', parentNodes);
        } 
        if (parentNodes.length === 0) return [];

        // Get the current component
        const childComponent = this.getBindingManager().getComponent(node.id);
        if (!childComponent) return [];

        // Map to store the highest value anchor for each channel type
        const highestAnchors: Record<string, { nodeId: string, anchorId: string, value: number }> = {};

        // 2. For each parent, find default configuration and compatible anchors
        for (const parentNode of parentNodes) {
            // Skip merged nodes
            if (parentNode.type === 'merged') continue;

            const parentComponent = this.getBindingManager().getComponent(parentNode.id);
            if (!parentComponent) continue;

            // Get all anchors for this parent
            const parentAnchors = parentComponent.getAnchors();
            // Process each parent anchor to find compatible anchors for the child component
            parentAnchors.forEach(parentAnchor => {
                const parentComponentId = parentAnchor.id.componentId;
                const anchorType = extractAnchorType(parentAnchor.id.anchorId);

                // Skip if no valid anchor type
                if (!anchorType || anchorType === AnchorType.OTHER) return;

                // Get available configurations from child component
                const availableConfigurations = childComponent.configurations.map(config => config.id);

                // Try to match with each configuration in the child component
                for (const configuration of availableConfigurations) {
                    const targetAnchorType = configuration ? `${configuration}_${anchorType}` : anchorType;
                    // Use a helper function to safely get the anchor
                    const targetAnchor = getAnchorSafely(childComponent, targetAnchorType);
                    if (!targetAnchor) {
                        // Skip if target anchor doesn't exist
                        continue;
                    }

                    // Calculate priority value for this anchor
                    // Extract numeric value from component ID if present (e.g., "node_5_x" -> 5)
                    const match = parentComponentId.match(/node_(\d+)/);
                    let priorityValue = match ? parseInt(match[1], 10) : 0;

                    // Compare schemas between parent and child anchors
                    const parentSchema = parentAnchor.anchorSchema[parentAnchor.id.anchorId];
                    const childSchema = targetAnchor.anchorSchema[targetAnchorType];

                    // Increase priority if schemas match
                    if (parentSchema && childSchema &&
                        parentSchema.container === childSchema.container &&
                        parentSchema.valueType === childSchema.valueType) {
                        priorityValue += 100;
                        console.log(`Increased priority for ${targetAnchorType} to ${priorityValue} due to schema match`);
                    }

                    // Update highest priority anchor for this channel
                    if (!highestAnchors[targetAnchorType] || priorityValue > highestAnchors[targetAnchorType].value) {
                        highestAnchors[targetAnchorType] = {
                            nodeId: parentNode.id,
                            anchorId: parentAnchor.id.anchorId,
                            value: priorityValue
                        };
                    }
                }
            });

            console.log('highestAnchors for ', childComponent.id)
            if (childComponent.id === 'node_1') {
                console.log('highestAnchors for node_1:', highestAnchors);
            }


            // Create new implicit binding edges for each anchor within the chiuld component based on the 
            // highest priority anchors found in the parent nodes (schema matched)
            for (const [channel, anchorInfo] of Object.entries(highestAnchors)) {
                // Find compatible target anchor on current node
                let pretargetAnchors = childComponent.getAnchors()
                    .filter(anchor => {
                        const targetChannel = extractAnchorType(anchor.id.anchorId);
                        return targetChannel && isAnchorTypeCompatible(channel, targetChannel);
                    })

                let targetAnchors = [...pretargetAnchors].filter(anchor => {
                    // implicit edges should only be used to transfer values from their parents NOT to constrain. 
                    // Get the channel from the current anchor
                    const targetChannel = extractAnchorType(anchor.id.anchorId);
                    if (!targetChannel) return false;

                    // Get the schema for this anchor
                    const targetSchema = anchor.anchorSchema[anchor.id.anchorId];
                    if (!targetSchema) return false;

                    // Get the schema for the source anchor
                    const sourceComponent = this.getBindingManager().getComponent(anchorInfo.nodeId);
                    if (!sourceComponent) return false;


                    const sourceAnchor = sourceComponent.getAnchor(anchorInfo.anchorId);
                    if (!sourceAnchor) return false;

                    const sourceSchema = sourceAnchor.anchorSchema[anchorInfo.anchorId];
                    if (!sourceSchema) return false;


                    // Check if the containers match
                    return sourceSchema.container === targetSchema.container;
                })

                if (targetAnchors.length === 0) continue;
                // Deduplicate target anchors based on anchorId
                const uniqueTargetAnchors = [];
                const seenAnchorIds = new Set();

                for (const anchor of targetAnchors) {
                    const anchorId = anchor.id.anchorId;
                    if (!seenAnchorIds.has(anchorId)) {
                        seenAnchorIds.add(anchorId);
                        uniqueTargetAnchors.push(anchor);
                    }
                }


                // Replace the original array with the deduplicated one
                targetAnchors = uniqueTargetAnchors;


                // Create implicit edges for each compatible target anchor
                for (const targetAnchor of targetAnchors) {

                    const implicitEdge: BindingEdge = {
                        source: {
                            nodeId: anchorInfo.nodeId,
                            anchorId: anchorInfo.anchorId
                        },
                        target: {
                            nodeId: node.id,
                            anchorId: targetAnchor.id.anchorId
                        },
                        implicit: true
                    };


                    // Add to implicit edges
                    // Check if this implicit edge already exists in the edges array
                    const edgeExists = implicitEdges.some(edge =>
                        edge.source.nodeId === implicitEdge.source.nodeId &&
                        edge.source.anchorId === implicitEdge.source.anchorId &&
                        edge.target.nodeId === implicitEdge.target.nodeId &&
                        edge.target.anchorId === implicitEdge.target.anchorId &&
                        edge.implicit === true
                    );

                    // Only add the edge if it doesn't already exist
                    if (!edgeExists) {
                        implicitEdges.push(implicitEdge);
                    }
                    // implicitEdges.push(implicitEdge)
                }
            }


        }
        return implicitEdges;
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
    private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        const { nodes, edges } = bindingGraph;
        const constraintsByNode: Record<string, Record<string, any[]>> = {};

        // Separate merged and regular nodes
        const { regularNodes, mergedNodeIds } = this.separateNodeTypes(nodes);

        // Process regular nodes
        const regularSpecs = this.compileRegularNodes(regularNodes, nodes, edges, constraintsByNode);

        // Process merged nodes
        const mergedSpecs = this.compileMergedNodes(mergedNodeIds, nodes, edges, constraintsByNode);


        return [...regularSpecs, ...mergedSpecs];
    }

    private separateNodeTypes(nodes: BindingNode[]): {
        regularNodes: BindingNode[],
        mergedNodeIds: Set<string>
    } {
        const mergedNodeIds = new Set<string>();
        const regularNodes = nodes.filter(node => {
            if (node.type === 'merged') {
                mergedNodeIds.add(node.id);
                return false;
            }
            return true;
        });

        return { regularNodes, mergedNodeIds };
    }

    private compileRegularNodes(
        regularNodes: BindingNode[],
        allNodes: BindingNode[],
        edges: BindingEdge[],
        constraintsByNode: Record<string, Record<string, any[]>>
    ): Partial<UnitSpec<Field>>[] {
        return regularNodes.map(node => {
            const component = this.getBindingManager().getComponent(node.id);
            if (!component) {
                console.warn(`Component ${node.id} not found`);
                return null;
            }


            const childEdges = edges.filter(edge => edge.source.nodeId === node.id);
            // Add implicit edges and build constraints

            const boundConfigurations = [...new Set(childEdges.map(edge => {
                return edge.source.anchorId.split('_')[0];
            }))];
            // Check if the component has a default configuration
            if (component) {
                // Find the default configuration
                const defaultConfig = component.configurations.find(config => config.default);
                if (defaultConfig && defaultConfig.id) {
                    // If the default configuration exists and is not already in boundConfigurations, add it
                    if (!boundConfigurations.includes(defaultConfig.id)) {
                        boundConfigurations.push(defaultConfig.id);
                    }
                }
            }

            let implicitEdges = this.buildImplicitContextEdges(node, edges, allNodes);

            console.log('all implicitEdges', implicitEdges)
            // Check if implicitEdges is undefined
            if (!implicitEdges) {
                console.error('implicitEdges is undefined', {
                    node,
                    edges,
                    allNodes,
                    boundConfigurations
                });
                // Provide a fallback empty array if implicitEdges is undefined
                implicitEdges = [];
            }
            const allEdges = [...edges, ...implicitEdges];

            console.log('alledge for ', node.id, allEdges.filter(edge=>edge.target.nodeId === node.id),allNodes)
            const constraints = this.buildNodeConstraints(node, allEdges, allNodes);


            // Store constraints for merged nodes
            constraintsByNode[node.id] = constraints;

            return component.compileComponent(constraints);
        }).filter((spec): spec is Partial<UnitSpec<Field>> => spec !== null);
    }

    private compileMergedNodes(
        mergedNodeIds: Set<string>,
        allNodes: BindingNode[],
        edges: BindingEdge[],
        constraintsByNode: Record<string, Record<string, any[]>>
    ): Partial<UnitSpec<Field>>[] {
        return Array.from(mergedNodeIds).map(nodeId => {
            const component = this.getBindingManager().getComponent(nodeId);
            if (!component) return null;

            const parentAnchors = this.getParentAnchors(nodeId, allNodes, edges);
            const mergedConstraints = extractConstraintsForMergedComponent(
                parentAnchors,
                constraintsByNode,
                component
            );

            type Update = {
                events: { signal: string }[];
                update: string;
            }
            const updates: Update[] = [];

            Object.keys(mergedConstraints).forEach(key => {
                const parentSignalName = key;
                const expression = mergeConstraints(mergedConstraints[key], parentSignalName);

                updates.push({
                    'events': [
                        {
                            'signal': parentSignalName
                        }
                    ],
                    'update': expression
                })
            })





            // const mergedSignals = mergedConstraints.map(constraint => {

            const mergedSignal = {
                name: nodeId,
                value: null,
                on: updates
            }



            return component.compileComponent({
                'VGX_MERGED_SIGNAL_NAME': mergedSignal
            });
        }).filter((spec): spec is Partial<UnitSpec<Field>> => spec !== null);
    }

    private getParentAnchors(
        nodeId: string,
        allNodes: BindingNode[],
        edges: BindingEdge[]
    ): { anchor: AnchorProxy, targetId: string }[] {
        return edges
            .filter(edge => edge.target.nodeId === nodeId)
            .map(edge => {
                const parentNode = allNodes.find(n => n.id === edge.source.nodeId);
                if (!parentNode) return null;

                const parentComponent = this.getBindingManager().getComponent(parentNode.id);
                if (!parentComponent) return null;

                const anchor = parentComponent.getAnchor(edge.source.anchorId);
                return anchor ? { anchor, targetId: anchor.id.anchorId } : null;
            })
            .filter((anchor): anchor is { anchor: AnchorProxy, targetId: string } => anchor !== null);
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

            constraints[targetAnchorId].push(
                generateDataConstraints(parentNodeSchema, anchorAccessor)
            );

        }
    }

    /**
     * Build constraint objects from parent nodes
     */
    private buildNodeConstraints(node: BindingNode, edges: BindingEdge[], allNodes: BindingNode[]): Record<string, Constraint[]> {
        const constraints: Record<string, Constraint[]> = {};

        // Find all edges where this node is the target
        const incomingEdges = edges.filter(edge => edge.target.nodeId === node.id);

        incomingEdges.forEach(edge => {
            const sourceNode = allNodes.find(n => n.id === edge.source.nodeId);
            if (!sourceNode) return;

            const sourceComponent = this.getBindingManager().getComponent(sourceNode.id);
            if (!sourceComponent) return;

            const anchor = sourceComponent.getAnchor(edge.source.anchorId);
            if (!anchor) return;


            const targetAnchorId = edge.target.anchorId
            const parentAnchorId = edge.source.anchorId

            const schema = anchor.anchorSchema[parentAnchorId];
            const value = anchor.compile();

            if (!schema || !value) {
                console.error('no schema or value', edge, anchor.anchorSchema, value);
                return;
            }

            const constraint = createConstraintFromSchema(
                schema,
                value,
                `${sourceNode.id}_${edge.source.anchorId}`,
                edge.implicit
            );

            if (!constraints[targetAnchorId]) {
                constraints[targetAnchorId] = [];
            }
            constraints[targetAnchorId].push(constraint);
        });



        return constraints;
    }

    public getProcessedGraph(startComponentId: string): ProcessedGraph {
        const elaboratedGraph = this.graphManager.buildCompilationGraph(startComponentId);

        const processedNodes = Array.from(elaboratedGraph.nodes.values()).map(node => {
            const component = this.getBindingManager().getComponent(node.id);
            return {
                component: node,
                anchors: component ? Array.from(component.getAnchors().values()) : []
            }
        });

        return {
            nodes: processedNodes,
            edges: elaboratedGraph.edges
        }
    }
}




export interface ProcessedNode {
    component: BindingNode;
    anchors: AnchorProxy[];
}
export interface ProcessedGraph {
    nodes: ProcessedNode[];
    edges: BindingEdge[];
}