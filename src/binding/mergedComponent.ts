import { BaseComponent } from "../components/base";
import { BindingManager } from "./BindingManager";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { extractAllNodeNames, generateSignalFromAnchor } from "../components/utils";
import { AnchorProxy } from "types/anchors";

export const MERGED_SIGNAL_NAME = 'VGX_MERGED_SIGNAL_NAME'
export function extractConstraintsForMergedComponent(parentAnchors: { anchor: AnchorProxy, targetId: string }[], compileConstraints: Record<string, any>, component: BaseComponent) {
    console.log('in mergedcomponentsparentAnchors', parentAnchors)
    // Get all parent components that feed into this merged component
    const parentComponentIds = parentAnchors.map(anchor => anchor.anchor.id.componentId);
    console.log('parentComponentIds for merged component:', parentComponentIds);

    const mergedSignals = []
    // For each parent component, get its compiled constraints
    parentComponentIds.forEach(parentId => {

        const parentConstraints = compileConstraints[parentId];
        // find the 
        // if (!parentConstraints) {
        //     console.log(`No constraints found for parent component ${parentId}`);
        //     return;
        // }


        console.log(`Processing parent ${parentId} with constraints:`, parentConstraints,);

        // Get the anchors from this parent that feed into the merged component
        const anchorFromParent = parentAnchors.find(anchor => anchor.anchor.id.componentId == parentId);// || [];


        if (!anchorFromParent) {
            console.log(`No anchor found for parent component ${parentId}`);
            return;
        }

        const parentSignalName = `${parentId}_${anchorFromParent.targetId}_internal`;
        console.log(`Parent signal name: ${parentSignalName}`);

        // For each other parent component, get its constraints
        const otherParentIds = parentComponentIds.filter(id => id !== parentId);
        console.log(`Other parent IDs for merged component:`, otherParentIds, 'og comp', component.id);

        // Get constraints for each other parent
        const otherParentsConstraints = otherParentIds.map(otherParentId => {
            const otherParentIdInternal = otherParentId;//+"_internal";
            const otherParentConstraints = compileConstraints[otherParentIdInternal];
            console.log('constraints', compileConstraints, 'otherParentConstraints', otherParentConstraints, anchorFromParent.targetId, 'otherParentIdInternal', otherParentIdInternal)
            if (!otherParentConstraints) {
                console.log(`No constraints found for other parent component ${otherParentId}`);
                return null;
            }
            console.log('otherParentConstraints', otherParentConstraints)



            // Okay, so at this point we need to go through and clone each of the other constraints and add
            // an update from them 
            // const parentSignalName = `${parentId}_${anchorFromParent.targetId}`;

            const channel = component.getAnchors()[0].id.anchorId;
            console.log('channel', channel)






            return otherParentConstraints[`${channel}_internal`].map(constraint => {
                console.log('constraint', constraint)
                return {
                    events: { "signal": parentSignalName },

                    update: constraint.replace(/VGX_SIGNAL_NAME/g, parentSignalName)
                }
            })

        }).filter(item => item !== null);

        mergedSignals.push(...otherParentsConstraints)


    })

    return mergedSignals
}


// Create a merged component to manage the cycle
export function createMergedComponent(
    node1Id: string,
    node2Id: string,
    channel: string,
    bindingManager: BindingManager
): BaseComponent {
    const component1 = bindingManager.getComponent(node1Id);
    const component2 = bindingManager.getComponent(node2Id);



    if (!component1 || !component2) {
        throw new Error(`Components not found: ${node1Id}, ${node2Id}`);
    }

    // Create a merged component that will manage the cycle
    class MergedComponent extends BaseComponent {
        mergedComponent: boolean;
        constructor() {
            super({});
            this.id = this.id+'_merged';
            this.mergedComponent = true;

            // TODO create two configurations for each of the base component types, for now we'll just do the second item
            this.schema = { [channel]: component2.schema[channel] };

            this.anchors.set(`${channel}`, this.createAnchorProxy(
                { [`${channel}`]: this.schema[`${channel}`] },
                `${channel}`,
                () => ({ 'absoluteValue': `${this.id}_${channel}` })
            ));


        }

        compileComponent(inputContext: any): Partial<UnitSpec<Field>> {


            console.log('compilingMergedComponent', inputContext)
            // Create internal signals for each node
            const nodeSignal = {
                name: `${this.id}_${channel}`,
                value: 0,
                on: [] as any[]
            };

           
            // TODO refactor Helper function to generate constraint application code
            function applyConstraints(signalName: string, containerType: string): string {
                if (containerType === 'Scalar') {
                    return `clamp(${signalName}, min_value, max_value)`;
                } else if (containerType === 'Range') {
                    return `nearest(${signalName}, [min_value, max_value])`;
                }
                return signalName;
            }

            console.log('inputContextMErged', inputContext)







            const outputSignals = Object.keys(this.schema).map(key => generateSignalFromAnchor(inputContext[key] || [], key, this.id, this.id, this.schema[key].container)).flat()

            // now merge two signals:
            const mergedSignal = {
                name: `${this.id}_${channel}`,
                value: 0,
                on: [] as any[]
            };

            console.log('outputSignals', outputSignals)



            // TODO:
            // fix the update statement on mergedSignal
            // right now they're empty. I think I need to add something for absolute value
            // then we also need to handle the other constraints. 
            // We may need to change merged component to compile after other components (e.g. so we don;t have random unfilled VGX_SIGNAL remaining. )            

            //TODO: make not 0...
            const updateStatements = inputContext[MERGED_SIGNAL_NAME].flat()
            console.log('inputContext[MERGED_SIGNAL_NAME]', updateStatements)
            for (const signal of updateStatements) {
                const nodeNames = extractAllNodeNames(signal.update)
                console.log('nodeNames', nodeNames)
                mergedSignal.on.push({
                    events: [...nodeNames.map(name => ({signal: name}))],
                    update: signal.update
                });
            }

            console.log('mergedSignal', mergedSignal)




            return {
                params: [mergedSignal]
            };
        }
    }

    return new MergedComponent();
}
