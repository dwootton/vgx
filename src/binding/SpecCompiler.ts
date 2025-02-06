import { BindingEdge, GraphManager, BindingGraph, BindingNode } from "./GraphManager";
import { BindingManager, VirtualBindingEdge,  } from "./BindingManager";
import { compilationContext, deduplicateById, validateComponent, removeUndefinedInSpec, logComponentInfo, detectAndMergeSuperNodes, resolveAnchorValue } from "./binding";
import { AnchorProxy } from "../types/anchors";
import { BaseComponent } from "../components/base";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { VariableParameter } from "vega-lite/build/src/parameter";
import { TopLevelSelectionParameter } from "vega-lite/build/src/selection"

import { getChannelFromEncoding } from "../utils/anchorGeneration/rectAnchors";

interface AnchorEdge {
    originalEdge: BindingEdge;
    anchorProxy: AnchorProxy;
}

export type Edge = AnchorEdge | VirtualBindingEdge;
type Parameter = VariableParameter | TopLevelSelectionParameter

export class SpecCompiler {
    constructor(
        private graphManager: GraphManager,
        private getBindingManager: () => BindingManager // Getter for BindingManager
    ) { }

    private hierarchyEdges: Map<string, BindingEdge[]> = new Map();


    // note: component Id will always be called from the root component
    public compile(fromComponentId: string): TopLevelSpec {

        const rootComponent = this.getBindingManager().getComponent(fromComponentId);
        if (!rootComponent) {
            throw new Error(`Component "${fromComponentId}" not found.`);
        }

        // specific binding graph for this tree
        let bindingGraph = this.graphManager.generateBindingGraph(rootComponent.id);

        // Compile the updated graph
        const compiledSpecs = this.compileBindingGraph(bindingGraph);

        //const compiledSpecs = this.compileBindingGraph(bindingGraph);
        const mergedSpec = mergeSpecs(compiledSpecs, rootComponent.id);

        return removeUndefinedInSpec(mergedSpec);
    }



    private compileBindingGraph(bindingGraph: BindingGraph): Partial<UnitSpec<Field>>[] {
        const { nodes, edges } = bindingGraph;
        const compiledComponents: Partial<UnitSpec<Field>>[] = [];

        const superNodeMap: Map<string, string> = detectAndMergeSuperNodes(edges);
        this.graphManager.setSuperNodeMap(superNodeMap);


        for (const node of nodes.values()) {
            const compiledNode = this.compileNode(node, edges);
            compiledComponents.push(compiledNode);
        }

        return compiledComponents;
    }


    private compileNode(node: BindingNode, graphEdges: BindingEdge[]): Partial<UnitSpec<Field>> {

        const filteredEdges = graphEdges.filter(edge => edge.target.nodeId === node.id)

        // maybe instead of turn edges into anchors, we should just keep edges, and add anchor property
        const incomingAnchors: AnchorEdge[] = this.prepareEdges(filteredEdges)

        // Okay, at this point you kept the edge with the anchor itself. Now you need to pipe those changes through. 
        // this will be nice because you can use the edge targetId to group now.
        // then within that, you just pipe the 


        //keeping a VSCode History Log- all of the comments you make to yourself, get logged. and the the compiler thinks of if 
        // you're talking to it, and then describes all fo th changes in a really nice git history. 

        // helpful for understanding 





        const anchorProxies = incomingAnchors.map(edge => edge.anchorProxy);
        //then, as we compile the node, we pass in the edges and it groups on edge.target.anchorId (then compiles)


        const superNodeMap: Map<string, string> = this.graphManager.getSuperNodeMap();

        let compilationContext = { nodeId: superNodeMap.get(node.id) || node.id };

        let component = this.getBindingManager().getComponent(node.id);



        compilationContext = this.buildPersonalizedCompilationContext(component, incomingAnchors, compilationContext);

        compilationContext = this.scalePropagation(node.id, compilationContext);

        console.log('compilationContext', compilationContext)


        // at this point compilationContext will have a grouped and ordered list of corresponding values. 


        const compiledSpec = this.compileComponentWithContext(node.id, compilationContext);
        return compiledSpec;
    }

    private findRootNode(nodeId: string): string {
        const bindingManager = this.getBindingManager();
        // search up the binding graph until we find the root node
        let currentId = nodeId;
        // while (bindingManager.getSourceBindingsForComponent(currentId).length > 0) {
        //     console.log('currentId',currentId)
        //     currentId = bindingManager.getTargetBindingsForComponent(currentId)[0].sourceId;
        // }
        return currentId;
    }

    private scalePropagation(nodeId: string, compilationContext: compilationContext): compilationContext {
        // Find root node by traversing up the binding graph
        const rootNodeId = 'node_3' //this.findRootNode(nodeId);
        if (!rootNodeId) return compilationContext;

        const rootComponent = this.getBindingManager().getComponent(rootNodeId);
        if (!rootComponent) return compilationContext;

        console.log('rootComponent', rootComponent)
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

    // private prepareEdges(graphEdges: BindingEdge[]): AnchorProxy[] {
    //     const anchorProxies = graphEdges
    //         .map(edge => getProxyAnchor(edge, this.getBindingManager().getComponent(edge.source.nodeId)));

    //     const expandedEdges = anchorProxies.flatMap(anchorProxy =>
    //         expandGroupAnchors(anchorProxy, anchorProxy.component)
    //     );

    //     return deduplicateById(expandedEdges);
    // }


    private buildPersonalizedCompilationContext(component: BaseComponent, edges: AnchorEdge[], compilationContext: compilationContext): compilationContext {
        // for each of component's anchors, we need to produce a group of the edges that are associated with that anchor

        const anchors = component.getAnchors();


        // group based on targetAnchorId

        const groupedEdges = edges.reduce((acc, edge) => {
            const targetAnchorId = edge.originalEdge.target.anchorId;
            if (!acc.has(targetAnchorId)) {
                acc.set(targetAnchorId, []);
            }
            acc.get(targetAnchorId)?.push(edge);
            return acc;
        }, new Map<string, Edge[]>());


        // filter out incompatible edges
        // for each property make sure that the 




        // this.getBindingManager().getVirtualBindings().forEach((virtualBinding, channel) => {
        //     if (!groupedEdges.has(channel)) {
        //         groupedEdges.set(channel, []);
        //     }
        //     groupedEdges.get(channel)?.push(virtualBinding);
        // });





        // now for each of the anchorMatchedEdges, we need to resolve the value of the edges
        for (const [anchorId, edges] of groupedEdges.entries()) {
            const superNodeMap: Map<string, string> = this.graphManager.getSuperNodeMap();
            const resolvedValue = resolveAnchorValue(edges, superNodeMap);
            compilationContext[anchorId] = resolvedValue;
        }


        // Add scale propagation from parent components
        const hierarchyAncestors = this.getHierarchyAncestors(compilationContext.nodeId);

        hierarchyAncestors.forEach(ancestorId => {
            const ancestorSpec = this.compileComponentWithContext(ancestorId, compilationContext);
            Object.entries(ancestorSpec.encoding || {}).forEach(([channel, enc]) => {
                if (!compilationContext[channel]?.scale) {
                    compilationContext[channel] = {
                        ...compilationContext[channel],
                        scale: enc?.scale,
                        scaleType: enc?.scale?.type
                    };
                }
            });
        });


        return compilationContext

        // TODO, channel edges have second priorty. 
        // for example, if a brush.left : drag_line, then we need to resolve brush.x1 (left), to drag_line.x, 
        // so if none of the edges have a direct map, then we use channel edges to resolve the value




        //console.log('personalized anchorMatchedEdges',anchorMatchedEdges)
        // console.log('personalized filteredChannelEdges',filteredChannelEdges)


        // we need to then resolve the value of each of the edges in the group

        // we need to then add the resolved value to the compilationContext
    }


    private getHierarchyAncestors(nodeId: string): string[] {
        const ancestors: string[] = [];
        let currentId = nodeId;

        while (this.hierarchyEdges.has(currentId)) {
            const edges = this.hierarchyEdges.get(currentId)!;
            edges.forEach(edge => {
                ancestors.push(edge.source.nodeId);
                currentId = edge.source.nodeId;
            });
        }

        return ancestors;
    }


    private compileComponentWithContext(nodeId: string, context: compilationContext): Partial<UnitSpec<Field>> {
        const component = this.getBindingManager().getComponent(nodeId);
        if (!component) {
            throw new Error(`Component "${nodeId}" not found.`);
        }
        validateComponent(component, nodeId);

        return component.compileComponent(context);
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

