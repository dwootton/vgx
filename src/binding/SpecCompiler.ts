import { BindingEdge, GraphManager, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager, VirtualBindingEdge, } from "./BindingManager";
import { AnchorProxy, SchemaType, SchemaValue, RangeValue, SetValue, ScalarValue } from "../types/anchors";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { extractConstraintsForMergedComponent } from "./mergedComponent";
import { extractAnchorType, isAnchorTypeCompatible } from "./cycles";
import { VegaPatchManager } from "../compilation/VegaPatchManager";
import { mergeSpecs } from "./utils";
import { createConstraintFromSchema } from "./constraints";
import { mergeConstraints } from "../components/utils";

interface AnchorEdge {
    originalEdge: BindingEdge;
    anchorProxy: AnchorProxy;
}

export type Edge = AnchorEdge | VirtualBindingEdge;

type AnchorId = string;
type Constraint = string;

function generateScalarConstraints(schema: SchemaType, value: SchemaValue): string {
    if(schema.container === 'Absolute'){
        return `${value.value}`;
    }
    if (schema.container === 'Data'){
        return `datum[${value.value}]`;
    }
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


function generateRangeConstraints(schema: SchemaType, value: SchemaValue): string {
    if(schema.container === 'Absolute'){
        console.
        return `${value.value}`;
    }

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

        const compiledSpecs = this.compileBindingGraph(fromComponentId, elaboratedGraph);

        const mergedSpec = mergeSpecs(compiledSpecs, fromComponentId);


        const patchManager = new VegaPatchManager(mergedSpec);

        
        return patchManager.compile();
       
    }


    private buildImplicitContextEdges(node: BindingNode, previousEdges: BindingEdge[], nodes: BindingNode[], boundConfigurations: string[]): BindingEdge[]{
        let edges = [...previousEdges]
        const implicitEdges = []

        // Skip if this is a merged node
        if (node.type === 'merged') {
            return [];
        }

        // 1. Find all parent nodes (nodes that have edges targeting the current node)
        const parentNodes = nodes.filter(n => 
            edges.some(edge => edge.source.nodeId === n.id && edge.target.nodeId === node.id)
        );

        
        if (parentNodes.length === 0) return [];
        
        // Get the current component
        const component = this.getBindingManager().getComponent(node.id);
        if (!component) return [];
        
        // Map to store the highest value anchor for each channel type
        const highestAnchors: Record<string, { nodeId: string, anchorId: string, value: number }> = {};
        
        // 2. For each parent, find default configuration and compatible anchors
        for (const parentNode of parentNodes) {
            // Skip merged nodes
            if (parentNode.type === 'merged') continue;
            
            const parentComponent = this.getBindingManager().getComponent(parentNode.id);
            if (!parentComponent) continue;
            
            // // Find default configuration for parent
            // const defaultConfigKey = Object.keys(parentComponent.configurations || {})
            //     .find(cfg => parentComponent.configurations[cfg]?.default);

            
            // if (!defaultConfigKey) continue;
            
            // Get all anchors for this parent
            const parentAnchors = parentComponent.getAnchors();
            // Process each anchor
            parentAnchors.forEach(anchor => {
                const componentId = anchor.id.componentId;
                const anchorType = extractAnchorType(anchor.id.anchorId);
                if (!anchorType) return;
                
                // Get the anchor's configuration prefix if it exists
                const anchorPrefix = anchor.id.anchorId.split('_')[0];
                
                // Process for all bound configurations, or use empty string if none match
                const configurationsToProcess = boundConfigurations.length > 0
                    ? boundConfigurations
                    : [''];

                
                for (const configuration of configurationsToProcess) {
                    const configurationAnchorType = configuration ? `${configuration}_${anchorType}` : anchorType;
                    
                    // Extract numeric value from anchor ID if present (e.g., "node_5_x" -> 5)
                    const match = componentId.match(/node_(\d+)/);
                    const value = match ? parseInt(match[1], 10) : 0;
                    
                    
                    // Update highest anchor for this channel if this one is higher
                    if (!highestAnchors[configurationAnchorType] || value > highestAnchors[configurationAnchorType].value) {
                        highestAnchors[configurationAnchorType] = {
                            nodeId: parentNode.id,
                            anchorId: anchor.id.anchorId,
                            value
                        };
                    }
                }
            })
        }
        // issue here is that implicit anchors match the first anchor vlaue (default), but
        // sometimes implicit anchors should match the items that other things are bound to. 
        // this suggests, we also need to have something around output context, or at least a sense
        // of if the configuration is being used elsewhere, and if so, use that configuration's value.
        // 3. Create implicit edges from highest parent anchors to this node
        for (const [channel, anchorInfo] of Object.entries(highestAnchors)) {
            // Find compatible target anchor on current node
            let targetAnchors = component.getAnchors()
                .filter(anchor => {
                    const targetChannel = extractAnchorType(anchor.id.anchorId);
                    return targetChannel && isAnchorTypeCompatible(channel, targetChannel);
                })
                .filter(anchor=>{
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
    private compileBindingGraph(rootId: string, bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
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
            const implicitEdges = this.buildImplicitContextEdges(node, edges, allNodes,boundConfigurations);


            const constraints = this.buildNodeConstraints(node, [...edges, ...implicitEdges], allNodes);
            

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
                const expression = mergeConstraints(mergedConstraints[key],parentSignalName );
                
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
                return anchor ? { anchor, targetId: edge.target.anchorId } : null;
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

            if(!schema || !value) {
                console.error('no schema or value', edge,  anchor.anchorSchema, value);
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