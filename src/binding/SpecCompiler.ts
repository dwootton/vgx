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
import { generateSignal, generateSignalsFromTransforms, mergeConstraints } from "../components/utils";
import { BaseComponent } from "components/base";
import { calculateValueForItem, getAllExpressions, mapSchemaToExpressions, mapSchemaToSignals, resolveSchemaValues } from "../components/resolveValue";
interface AnchorEdge {
    originalEdge: BindingEdge;
    anchorProxy: AnchorProxy;
}

export type Edge = AnchorEdge | VirtualBindingEdge;

type AnchorId = string;
type Constraint = string;

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

interface CompileContext {
    VGX_SIGNALS: any[];
    schemaValues: Record<string, BindingEdge[]>;
    constraints: Record<string, any[]>;
}

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

        // Skip if this is a merged node
        if (node.type === 'merged') {
            return [];
        }

        // 1. Find all parent nodes (nodes that have edges targeting the current node)
        const parentNodes = nodes.filter(n =>
            edges.some(edge => edge.source.nodeId === n.id && edge.target.nodeId === node.id)
        ).flatMap(n => {
            // if the node is a merged nodes, extract what other nodes were originally part of it
            // TODO: other ndoes might have been children.... this is a hack
            if (n.type === 'merged') {
                return extractOtherNodesFromMergedId(n.id, node.id).map(id => nodes.find(n => n.id === id));
            }
            return [n];
        }).filter(n => n !== undefined);

        if (parentNodes.length === 0) return [];

        //2. Get the current component
        const childComponent = this.getBindingManager().getComponent(node.id);
        if (!childComponent) return [];

        // Map to store the highest value anchor for each channel type
        const highestAnchors: Record<string, { nodeId: string, anchorId: string, value: number }> = {};

        // 3. For each parent of the child component, find their default configuration and compatible anchors
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


            // 4. Create new implicit binding edges for each anchor within the chiuld component based on the 
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

    private generateComponentSignals(
        component: BaseComponent, 
        nodeId: string, 
        allConstraints: Record<string, any[]>
    ): any[] {

        // Filter out implicit constraints when there are other constraints available
        const filteredConstraints: Record<string, any[]> = {};
        
        for (const [key, constraintArray] of Object.entries(allConstraints)) {
            if (Array.isArray(constraintArray)) {
                // Check if there are both implicit and non-implicit constraints
                const hasImplicit = constraintArray.some(constraint => constraint?.isImplicit === true);
                const hasNonImplicit = constraintArray.some(constraint => constraint && constraint?.isImplicit !== true);
                
                // If we have both types, filter out the implicit ones
                if (hasImplicit && hasNonImplicit) {
                    
                    filteredConstraints[key] = constraintArray.filter(constraint => 
                        constraint && constraint?.isImplicit !== true
                    );
                } else {

                    // Otherwise keep all constraints (including just implicit ones)
                    filteredConstraints[key] = constraintArray;
                }
            } else {
                // If not an array, just pass it through
                filteredConstraints[key] = constraintArray;
            }
        }
        
        // De-duplicate constraints that are the same
        for (const [key, constraintArray] of Object.entries(filteredConstraints)) {
            if (Array.isArray(constraintArray) && constraintArray.length > 1) {
                // Create a map to track unique constraints by their string representation
                const uniqueConstraints = new Map();
                
                // Process each constraint
                constraintArray.forEach(constraint => {
                    if (!constraint) return;
                    
                    // Create a string key representing the constraint's essential properties
                    const constraintKey = JSON.stringify({
                        value: constraint.value,
                        triggerReference: constraint.triggerReference,
                        type: constraint.type
                    });
                    
                    // Only add if we haven't seen this constraint before
                    if (!uniqueConstraints.has(constraintKey)) {
                        uniqueConstraints.set(constraintKey, constraint);
                    }
                });
                
                // Replace the original array with de-duplicated constraints
                filteredConstraints[key] = Array.from(uniqueConstraints.values());
            }
        }
       
        // Use the filtered constraints for signal generation
        const constraints = filteredConstraints;

        // Generate output signals from configurations
        const outputSignals = Object.values(component.configurations)
            .filter(config => Array.isArray(config.transforms))
            .flatMap(config => {
                const constraintMap = {};
                Object.keys(config.schema).forEach(channel => {
                    const key = `${config.id}_${channel}`;
                    constraintMap[channel] = constraints[key] || [];
                });

                return generateSignalsFromTransforms(
                    config.transforms,
                    nodeId,
                    component.id + '_' + config.id,
                    constraintMap
                );
            });

        // Generate internal signals
        const internalSignals = [...component.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                let internalConstraints = constraints[key] || ["VGX_SIGNAL_NAME"];
                const configId = key.split('_')[0];
                const config = component.configurations.find(config => config.id === configId);
                const compatibleTransforms = config.transforms.filter(
                    transform => transform.channel === key.split('_')[1]
                );
                
                return compatibleTransforms.map(transform => generateSignal({
                    id: nodeId,
                    transform: transform,
                    output: nodeId + '_' + key,
                    constraints: internalConstraints
                }));
            }).flat();

        return [...outputSignals, ...internalSignals];
    }

    private buildSchemaValues(
        component: BaseComponent,
        edges: BindingEdge[]
    ): Record<string, BindingEdge[]> {
        const schemaValues: Record<string, BindingEdge[]> = {};
        
        // Get all schema keys from base configuration
        const baseConfig = component.configurations.find(config => config.default);
        if (baseConfig) {
            Object.keys(baseConfig.schema).forEach(schemaKey => {
                // Find all edges that target this schema key
                schemaValues[schemaKey] = edges.filter(edge => {
                    const targetKey = edge.target.anchorId.split('_').pop();
                    return targetKey === schemaKey;
                });
            });
        }

        return schemaValues;
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

            const componentEdges = edges.filter(edge => edge.target.nodeId === node.id);

            // Build implicit edges
            const implicitEdges = this.buildImplicitContextEdges(node, componentEdges, allNodes) || [];
            const allEdges = [...componentEdges, ...implicitEdges];

            // Build constraints
            const constraints = this.buildNodeConstraints(node, allEdges, allNodes);
            constraintsByNode[node.id] = constraints;

            // Generate all signals
            const allSignals = this.generateComponentSignals(component, node.id, constraints);

            // Build schema values mapping
            const schemaValues = this.buildSchemaValues(component, allEdges);

            // Create compile context
            const compileContext: CompileContext = {
                VGX_SIGNALS: allSignals,
                schemaValues,
                constraints
            };

            const baseSchema = component.configurations.find(config => config.default)?.schema;
             // Map schema keys to their relevant signals
            const schemaSignals = mapSchemaToSignals(
                component,
                allSignals,
                edges,
            );


            const context = calculateValueForItem(component, allSignals, constraints);
            console.log('REALvalue', context, component)



            const expressions = getAllExpressions(schemaSignals, baseSchema, constraints);
            // const expressions = mapSchemaToExpressions(schemaSignals, baseSchema);


            const resolvedValues = resolveSchemaValues(schemaValues, baseSchema, allSignals);

            // console.log('compileContext', resolvedValues)

            return component.compileComponent({...{'VGX_CONTEXt':context}, ...compileContext.constraints});
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

            if (sourceNode.id === 'node_4' && edge.source.anchorId === 'transform_text') {

                console.log('2sdscfs:', constraint, JSON.parse(JSON.stringify(constraints)), constraints[targetAnchorId], targetAnchorId);
                console.log('creating new', JSON.parse(JSON.stringify(constraints)), targetAnchorId, !constraints[targetAnchorId])
            }

            if (!constraints[targetAnchorId]) {
                constraints[targetAnchorId] = [];
            }
            if (sourceNode.id === 'node_4' && edge.source.anchorId === 'transform_text') {

                console.log('2sdscfsbefore:', constraint, JSON.parse(JSON.stringify(constraints)));
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