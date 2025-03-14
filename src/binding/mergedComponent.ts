import { BaseComponent } from "../components/base";
import { BindingManager } from "./BindingManager";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { extractAllNodeNames, generateSignalFromAnchor } from "../components/utils";
import { AnchorProxy, SchemaType } from "../types/anchors";
import { MergedComponent } from "./MergedComponentClass";


export const MERGED_SIGNAL_NAME = 'VGX_MERGED_SIGNAL_NAME'

export function extractConstraintsForMergedComponent(parentAnchors: { anchor: AnchorProxy, targetId: string }[], compileConstraints: Record<string, any>, component: BaseComponent) {
    console.log('in mergedcomponentsparentAnchors', parentAnchors,'all compileConstraints', JSON.parse(JSON.stringify(compileConstraints)))
    // Get all parent components that feed into this merged component
    const parentComponentIds = parentAnchors.map(anchor => anchor.anchor.id.componentId);
    console.log('parentComponentIds for merged component:', parentComponentIds);

    const mergedSignals = []

    // For each input into the merged component, get what their constraints were so they can be applied to the other update statements
    parentComponentIds.forEach(parentId => {

        const parentConstraints = compileConstraints[parentId];
        // find the 
        // if (!parentConstraints) {
        //     console.log(`No constraints found for parent component ${parentId}`);
        //     return;
        // }


        console.log(`Processing parent ${parentId} with constraints:`, JSON.parse(JSON.stringify(parentConstraints || {})),);

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
            console.log('constraints', JSON.parse(JSON.stringify(compileConstraints || {})), 'otherParentConstraints', JSON.parse(JSON.stringify(otherParentConstraints || {})), otherParentIdInternal, anchorFromParent.targetId, 'otherParentIdInternal', otherParentIdInternal)
            if (!otherParentConstraints) {
                console.log(`No constraints found for other parent component ${otherParentId}`);
                return null;
            }
            console.log('otherParentConstraints', otherParentConstraints)



            // Okay, so at this point we need to go through and clone each of the other constraints and add
            // an update from them 
            // const parentSignalName = `${parentId}_${anchorFromParent.targetId}`;

            const channel = component.getAnchors()[0].id.anchorId;
            console.log('channel', channel,"otherParentConstraints", JSON.parse(JSON.stringify(otherParentConstraints)))






            return (otherParentConstraints[`${channel}_internal`] || []).map(constraint => {
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

    class MergedComponent extends BaseComponent {
        mergedComponent: boolean;
        signalName: string;
        constructor(channel:string, schema: SchemaType) {
            super({});
            this.id = this.id+'_merged';
            this.mergedComponent = true;
            this.signalName = `${this.id}_${channel}`;
    
            // TODO create two configurations for each of the base component types, for now we'll just do the second item
            this.schema = { [channel]: schema };
    
            this.anchors.set(`${channel}`, this.createAnchorProxy(
                { [`${channel}`]: this.schema[`${channel}`] },
                `${channel}`,
                () => ({ 'absoluteValue': `${this.id}_${channel}` })
            ));
    
    
        }
    
        compileComponent(inputContext: any): Partial<UnitSpec<Field>> {
    
            // const outputSignals = Object.keys(this.schema).map(key => generateSignalFromAnchor(inputContext[key] || [], key, this.id, this.id, this.schema[key].container)).flat()
            // now merge two signals:
            const mergedSignal = {
                name: this.signalName,
                value: 0,
                on: [] as any[]
            };
    
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

    // Create a merged component that will manage the cycle
    

    return new MergedComponent(channel, component2.getAnchors()[0].anchorSchema[channel]);
}

