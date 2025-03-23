import { BindingEdge, GraphManager, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager, VirtualBindingEdge, } from "./BindingManager";
import { AnchorProxy, SchemaType, SchemaValue, RangeValue, SetValue, ScalarValue } from "../types/anchors";
import { BaseComponent } from "../components/base";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { VariableParameter } from "vega-lite/build/src/parameter";
import { TopLevelSelectionParameter } from "vega-lite/build/src/selection"
import { getGenericAnchorTypeFromId } from "../utils/anchorGeneration/rectAnchors";
import { extractConstraintsForMergedComponent, VGX_MERGED_SIGNAL_NAME } from "./mergedComponent";
import { resolveCycleMulti, expandEdges, extractAnchorType, isCompatible } from "./cycles";
import { pruneEdges } from "./prune";
import { VegaPatchManager } from "../compilation/VegaPatchManager";
import { mergeSpecs } from "./utils";

interface AnchorEdge {
    originalEdge: BindingEdge;
    anchorProxy: AnchorProxy;
}

export type Edge = AnchorEdge | VirtualBindingEdge;
type Parameter = VariableParameter | TopLevelSelectionParameter

type AnchorId = string;
type Constraint = string;

function generateScalarConstraints(schema: SchemaType, value: SchemaValue): string {
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
            
            // Find default configuration for parent
            const defaultConfigKey = Object.keys(parentComponent.configurations || {})
                .find(cfg => parentComponent.configurations[cfg]?.default);

            
            if (!defaultConfigKey) continue;
            
            // Get all anchors for this parent
            const parentAnchors = parentComponent.getAnchors();
            // Process each anchor
            parentAnchors.forEach(anchor => {
                const anchorId = anchor.id.anchorId;
                const channel = extractAnchorType(anchorId);
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
            
            // Add implicit edges and build constraints
            const implicitEdges = this.buildImplicitContextEdges(node, edges, allNodes);
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
            const mergedSignals = extractConstraintsForMergedComponent(
                parentAnchors, 
                constraintsByNode, 
                component
            );
            
            return component.compileComponent({
                'VGX_MERGED_SIGNAL_NAME': mergedSignals
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

            const parentNode = allNodes.find(n => n.id === parentEdge.source.nodeId);
            if(!parentNode) {
                console.error(`Parent node not found: ${parentEdge.source.nodeId} for target: ${node.id}`);
                continue;
            }
            
            const parentComponent = this.getBindingManager().getComponent(parentNode.id);
            if(!parentComponent) {
                console.error(`Parent component not found: ${parentNode.id} for target: ${node.id}`);
                continue;
            }

            const anchorProxy = parentComponent.getAnchor(parentEdge.source.anchorId);
            if(!anchorProxy) {
                console.error(`Anchor not found: ${parentEdge.source.anchorId} on component: ${parentNode.id} for target: ${node.id}`);
                continue;
            }
            
            // Get the schema and value from the parent anchor
            const targetAnchorId = parentEdge.target.anchorId;
            const targetAnchorSchema = component.schema[targetAnchorId];

            const cleanTargetId = targetAnchorId.replace('_internal', '');

            const currentNodeSchema = component.schema[cleanTargetId]
            const parentNodeSchema = anchorProxy.anchorSchema[parentEdge.source.anchorId];
           
            // Skip if no schema exists for this channel
            if (!currentNodeSchema) {
                console.error(`Schema not found for channel: ${cleanTargetId} on component: ${node.id}`);
                continue;
            }

            // Initialize constraint array if needed
            if (!constraints[targetAnchorId]) {
                constraints[targetAnchorId] = [];
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