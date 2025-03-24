import { extractAnchorType } from "../binding/cycles";
import { Constraint } from "../binding/constraints";

type CompilationContext = Record<string, Constraint[]>;



function schemaCompatibility(schemaId: string, anchorId: string): boolean {
    const schemaType = extractAnchorType(schemaId);
    const anchorType = extractAnchorType(anchorId);

    console.log('schemaType', schemaType, 'anchorType', anchorType);
    
    // First check if the anchor types match
    if (schemaType !== anchorType) {
        return false;
    }
    
    // Special handling for positional anchors
    if (['x', 'y'].includes(schemaType)) {
        // Extract modifiers (start/stop, 1/2, etc.)
        const schemaModifier = schemaId.includes('_') ? schemaId.split('_').pop() : '';
        const anchorModifier = anchorId.includes('_') ? anchorId.split('_').pop() : '';

        console.log('schemaModifier', schemaModifier,schemaId, 'anchorModifier', anchorModifier, anchorId);
        
        // Handle x1/y1 compatibility with start
        if ((schemaModifier === '1' || schemaModifier === 'start') && 
            (anchorModifier === '1' || anchorModifier === 'start')) {
            return true;
        }
        
        // Handle x2/y2 compatibility with stop
        if ((schemaModifier === '2' || schemaModifier === 'stop') && 
            (anchorModifier === '2' || anchorModifier === 'stop')) {
            return true;
        }
        
        // If no modifiers or they're the same, they're compatible
        if (schemaModifier === anchorModifier) {
            return true;
        }
        
        return false;
    }
    
    // For non-positional anchors, just check if the base types match
    return true;
}

function findAnchorConstraints(schemaId: string, context: CompilationContext, configurations: any): Constraint[] {
    // get anchorType from schemaId, and then all of the anchorIds in context that have that anchorType
    const anchorType = extractAnchorType(schemaId);
    console.log('anchorTypeasda', anchorType, configurations);
    const anchorIds = Object.keys(context).filter(id => extractAnchorType(id) === anchorType);
    console.log('anchorIdssda', schemaId,anchorIds, context,Object.keys(context), configurations);

    // return a set of all constraints that are applicable to that schemaId
    // so 'x1' should return things for 'point_x', and 'interval_start_x', but not 'interval_start_y' or 'interval_stop_x'

    // const expandConfiguration
    // Check compatibility between schema ID and anchor ID
    
    
    // Filter to only compatible anchor IDs
    const compatibleAnchorIds = anchorIds.filter(id => schemaCompatibility(schemaId, id));
    console.log('compatibleAnchorIds', compatibleAnchorIds);

    
    

    const allConstraints= compatibleAnchorIds.map(id => context[id]).flat();

    console.log('allConstraints', allConstraints);

    return allConstraints;
    

}

export function constructValueFromContext(
    schemaId: string,
    context: CompilationContext,
    componentId: string,
    configurations: any
): any {
    const anchorConstraints = findAnchorConstraints(schemaId, context, configurations);

    // merge anchorConstraints together, this will give us 

    return {
        value: 'datum[\'x\']',
        signals: ['_all'],
        data: ['x']
    }

    const mergedConstraints = mergeAnchorValues(anchorConstraints, context, componentId);


    
}

export function fakeconstructValueFromContext(
    anchorId: string,
    context: CompilationContext,
    componentId: string
): { value: any, signals?: string[], data?: string[] } {
    // Initialize return values
    let signals: string[] = [];
    let data: string[] = [];
    
    // Get the specific anchor constraints
    const anchorConstraints = context[anchorId] || [];
    
    // Check if this anchor is a data type by extracting its type
    const anchorType = extractAnchorType(anchorId);
    const isDataAnchor = anchorType === 'data';
    
    // If this anchor is a data type, return the data reference
    if (isDataAnchor) {
        console.log('in data anchor', anchorConstraints);
        // Find the constraint with the data value
        const dataConstraint = anchorConstraints.find(c => c.value);
        if (dataConstraint && dataConstraint.value) {
            data.push(dataConstraint.value);
            return {
                value: `datum['${dataConstraint.value}']`,
                data
            };
        } else {
            return {
                value: {'values':[{'val3':5}]}
            }
        }
    }
    
    // If we have other constraints, return a signal reference
    if (anchorConstraints.length > 0) {
        const signalName = `${componentId}_${anchorId}`;
        signals.push(signalName);
        
        // Extract any referenced signals from constraints
        anchorConstraints.forEach(constraint => {
            if (constraint.triggerReference) {
                signals.push(constraint.triggerReference);
            }
        });
        
        return {
            value: signalName,
            signals
        };
    }
    
    // If we have a direct value in the context, return it
    for (const [key, constraints] of Object.entries(context)) {
        if (key.includes(anchorId) && constraints.length > 0) {
            const constraint = constraints[0];
            if (constraint.type === 'ABSOLUTE' && constraint.value !== undefined) {
                return { value: constraint.value };
            }
        }
    }
    
    // Fallback to a default signal reference
    const defaultSignal = `${componentId}_${anchorId}`;
    signals.push(defaultSignal);
    return {
        value: defaultSignal,
        signals
    };
}