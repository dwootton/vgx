import { BindingManager } from "./BindingManager";
import { BindingEdge, BindingGraph, BindingNode } from "./GraphManager";
import { createMergedComponent } from "./mergedComponent";

export function resolveCycles(expandedEdges: BindingEdge[], nodes: Map<string, BindingNode>, cycleNodes: Set<string>, cycleEdges: BindingEdge[], bindingManager: BindingManager): BindingGraph {
    // Convert Set to Array to access elements by index
    const cycleNodesArray = Array.from(cycleNodes);
    const mergedComponent = createMergedComponent(cycleNodesArray[0], cycleNodesArray[1], cycleEdges[0].target.anchorId, bindingManager);

    console.log('mergedComponent', mergedComponent)

    // Create a new merged node ID
    const mergedNodeId = mergedComponent.id;


    // Add the merged component to the binding manager
    bindingManager.addComponent(mergedComponent);

    // // Add the merged node to the graph
    // bindingGraph.nodes.set(mergedNodeId, {
    //     id: mergedNodeId,
    //     type: 'merged',
    // });

    const newNodes = new Map(nodes)
        .set(mergedNodeId, {
            id: mergedNodeId,
            type: 'merged',
            // component: mergedComponent
        });

    // bindingGraph.nodes.set(mergedNodeId, {
    //     id: mergedNodeId,
    //     type: 'merged',
    //     // component: mergedComponent
    // });

    // Remove cycle edges
    const newEdges = expandedEdges.filter(edge => {
        // Filter out edges between cycle nodes
        return !(cycleNodes.has(edge.source.nodeId) && cycleNodes.has(edge.target.nodeId))
    });

    // Add new edges from each component to the merged component
    cycleNodes.forEach(nodeId => {
        // For each cycle node, create an edge to the merged node
        // using the same anchor IDs as in the original cycle
        const relevantEdge = cycleEdges.find(edge =>
            edge.source.nodeId === nodeId || edge.target.nodeId === nodeId
        );

        if (relevantEdge) {
            const anchorId = nodeId === relevantEdge.source.nodeId
                ? relevantEdge.source.anchorId
                : relevantEdge.target.anchorId;




            const originalComponent = bindingManager.getComponent(nodeId);
            const originalAnchor = originalComponent.getAnchor(anchorId);

            // Extract component from original anchor
            const { component, ...anchorWithoutComponent } = originalAnchor;

            // Deep clone everything except the component
            const clonedAnchorProps = deepClone(anchorWithoutComponent);

            // Reconstruct the anchor with the original component reference
            const clonedAnchor = {
                ...clonedAnchorProps,
                component
            };

            const originalResult = originalAnchor.compile();

            // Modify the compile function of the cloned anchor
            clonedAnchor.compile = () => {
                console.log('originalResult', originalResult, `${originalAnchor.id.componentId}-${originalResult.value}_internal`)
                // Handle different SchemaValue types (ScalarValue, SetValue, RangeValue)
                if ('value' in originalResult) {
                    const value = originalResult.value;
                    console.log('prereplace', value)
                    // Use the return value of replace since strings are immutable
                    const updatedValue = value.replace('VGX_SIGNAL_NAME', `${originalAnchor.id.componentId}`);

                    console.log('postreplace', updatedValue)
                    return { value: `${updatedValue}_internal` };
                } else {
                    // For other types, just return a modified version
                    return originalResult;
                }
            };


            console.log('originalAnchor', originalAnchor)
            console.log('originalComponent', originalComponent)

            function deepClone(obj: any) {
                return JSON.parse(JSON.stringify(obj));
            }

            const internalAnchorId = `${anchorId}_internal`;
            // originalComponent.setAnchor(anchorId, clonedAnchor);
            console.log('clonedAnchor', clonedAnchor)
            originalComponent.setAnchor(internalAnchorId, clonedAnchor); // this is the same as the original
            //now retarget all of the inczwoming edges to this new anchor

            const incomingEdges = expandedEdges.filter(edge => edge.target.nodeId === nodeId && edge.target.anchorId === anchorId);
            incomingEdges.forEach(edge => {
                edge.target.anchorId = internalAnchorId;
            });
            //then add the new edge to the original anchor e.g. node_1_x. this will overwrite its value so any place it is used 
            // will use the merged value
            newEdges.push({
                source: { nodeId, anchorId: internalAnchorId },
                target: { nodeId: mergedNodeId, anchorId }
            });

            newEdges.push({
                source: { nodeId: mergedNodeId, anchorId },
                target: { nodeId, anchorId } // target the original anchor so anything that reads from it gets the merged value
            });

            // originalComponent.setAnchor(anchorId, originalAnchor);
        }

    });


    return { nodes: newNodes, edges: newEdges };

}