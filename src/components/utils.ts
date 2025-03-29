//Components: 

import { extractAnchorType } from "../binding/cycles";
import { compileConstraint, Constraint, ConstraintType } from "../binding/constraints";
import { extractSignalNames } from "../binding/mergedComponent";
import { CompilationContext } from "binding/binding";

// creates the accessor for the signal backing the range
// export const createRangeAccessor = (id: string, channel: string) => {
//     return {
//         'start': `${id}.${channel}.start`,
//         'stop': `${id}.${channel}.stop`,
//     }
// }

// export const createRangeAccessor = (id: string, channel: string) => {
//         return {
//             'start': `${id}_${channel}_start`,
//             'stop': `${id}_${channel}_stop`,
//         }
//     }
    

export const createRangeAccessor = (id: string, channel: string, configurationId: string) => {
    return {
        'start': `${id}_${configurationId}_start_${channel}`,
        'stop': `${id}_${configurationId}_stop_${channel}`,
    }
}

export function generateCompiledValue(id: string, channel: string) {
    return  `${id}_${channel}` // min value
}

export function extractAllNodeNames(input: string): string[] {
    const nodeNames: string[] = [];

    // Find all node_X.something patterns (return just node_X)
    const dotPattern = /(node_\d+)\./g;
    let dotMatch;

    while ((dotMatch = dotPattern.exec(input)) !== null) {
        if (dotMatch[1] && !nodeNames.includes(dotMatch[1])) {
            nodeNames.push(dotMatch[1]);
        }
    }

    // Find all node_X_something patterns (return the whole thing)
    const underscorePattern = /\b(node_\d+(?:_[^,)\s.]+))\b/g;
    let underscoreMatch;

    while ((underscoreMatch = underscorePattern.exec(input)) !== null) {
        if (underscoreMatch[1] && !nodeNames.includes(underscoreMatch[1])) {
            nodeNames.push(underscoreMatch[1]);
        }
    }

    // Find merged node patterns like node_X_node_Y_merged
    const mergedNodePattern = /\b(merged_node_\d+_node_\d+(?:_[^,)\s.]+)?)\b/g;
    let mergedNodeMatch;

    while ((mergedNodeMatch = mergedNodePattern.exec(input)) !== null) {
        if (mergedNodeMatch[1] && !nodeNames.includes(mergedNodeMatch[1])) {
            nodeNames.push(mergedNodeMatch[1]);
        }
    }

    // Find any remaining bare node_X patterns that weren't caught above
    const barePattern = /\b(node_\d+)\b(?![\._])/g;
    let bareMatch;

    while ((bareMatch = barePattern.exec(input)) !== null) {
        if (bareMatch[1] && !nodeNames.includes(bareMatch[1])) {
            nodeNames.push(bareMatch[1]);
        }
    }

    return [...new Set(nodeNames)];
}
export const generateScalarSignalFromAnchor = (constraints: string[], anchorId: string, parentExtractor: string, mergedParent: string): any[] => {
    let channel = anchorId;

    // Check if any constraint is undefined or contains undefined
    if (constraints.some(constraint => constraint === undefined)) {
        console.warn(`Skipping signal generation for ${anchorId} due to undefined constraints`);
        return [];
    }
    
    const parentSignal = extractAllNodeNames(parentExtractor)[0];
    const signalName = mergedParent + '_' + channel;

    const generateConstraints = (update: string) => {
        return {
            events: [ extractAllNodeNames(update).map(node => ({
                signal: node
            }))],
            update: update.replace(/VGX_SIGNAL_NAME/g, signalName)
        }
    };

    const clampedExtractor = collapseSignalUpdates(constraints.map(generateConstraints), parentExtractor)
    const depedentNodes = extractAllNodeNames(clampedExtractor).filter(node => node !== signalName)

    return [{
        name: signalName,
        value: null,
        on: [{
            events: [{
                signal: parentSignal
            }, ...depedentNodes.map(node => ({
                signal: node
            }))],
            update: clampedExtractor
        }]
    }];
}

export const generateRangeSignalFromAnchor = (constraints: string[], anchorId: string, signalParent: string, mergedParent: string): any[] => {
    let channel = anchorId;

    // Check if any constraint is undefined or contains undefined
    if (constraints.some(constraint => constraint === undefined)) {
        console.warn(`Skipping signal generation for ${anchorId} due to undefined constraints`);
        return [];
    }
    
    const startSignalName = mergedParent + '_'  + '_start' + channel;
    const stopSignalName = mergedParent + '_' + '_stop' + channel;

    const startParentExtractor = signalParent + "." + channel + ".start";
    const stopParentExtractor = signalParent + "." + channel + ".stop";

    const generateStartConstraints = (update: string) => {
        return {
            events: {
                signal: startSignalName
            },
            update: `${update.replace(/VGX_SIGNAL_NAME/g, startParentExtractor)}`
        }
    };

    const generateStopConstraints = (update: string) => {
        return {
            events: {
                signal: stopSignalName
            },
            update: `${update.replace(/VGX_SIGNAL_NAME/g, stopParentExtractor)}`
        }
    };

    const clampedStartExtractor = collapseSignalUpdates(constraints.map(generateStartConstraints), startParentExtractor)
    const clampedStopExtractor = collapseSignalUpdates(constraints.map(generateStopConstraints), stopParentExtractor)

    const depedentStartNodes = extractAllNodeNames(clampedStartExtractor)
    const depedentStopNodes = extractAllNodeNames(clampedStopExtractor)


    return [
        {
            name: startSignalName,
            on: [{
                events: [{
                    signal: signalParent
                }, ...depedentStartNodes.map(node => ({
                    signal: node
                }))],
                update: clampedStartExtractor
            }],
        },
        {
            name: stopSignalName,
            on: [{
                events: [{
                    signal: signalParent
                }, ...depedentStopNodes.map(node => ({
                    signal: node
                }))],
                update: clampedStopExtractor
            }],
        }
    ];
}
// Core types for the signal generation system
interface Transform {
    name?: string;      // Optional name for the generated signal
    channel: string;    // The channel this transform applies to (x, y, etc)
    value: string;      // Expression to extract value (e.g. "BASE_NODE_ID.x.start")
  }
  
  interface SignalConfig {
    id: string;         // Parent/source component ID
    transform: Transform;  // How to extract the value
    output: string;     // Target signal name
    constraints: Constraint[];  // Constraints to apply
  }
  

  // Helper function to compile constraint with transform placeholder
  const compileConstraintWithTransform = (constraint: Constraint): string => {
    if (!constraint) return "VGX_TRANSFORM_VALUE";
   
    const compiled = compileConstraint(constraint);
    return compiled.replace(constraint.triggerReference || "", "VGX_TRANSFORM_VALUE");
};

// Find compatible constraints for a transform
const findCompatibleConstraints = (transform: Transform, allConstraints: Constraint[]): Constraint[] => {
    if(allConstraints.some(constraint=>constraint.type === ConstraintType.ABSOLUTE)){
        const absoluteConstraint = allConstraints.find(constraint=>constraint.type === ConstraintType.ABSOLUTE) as Constraint;
        return [absoluteConstraint];
    }
    const transformName = transform.name || '';

    return allConstraints.filter(constraint => {
        if (!constraint) return false;

        const constraintName = constraint.triggerReference || '';
        const constraintEnding = generateAnchorId(constraintName)//.split('_').pop() || constraintName;
        return areNamesCompatible(transformName, constraintEnding);
    });
};

export const generateAnchorId = (name: string): string => {
                
    
    if (name.includes('start_')) {
        return 'start_' + name.split('start_')[1];
    } else if (name.includes('stop_')) {
        return 'stop_' + name.split('stop_')[1];
    } else {
        return name.split('_').pop() || name;
    }
};

export function areNamesCompatible(name1:string, name2:string): boolean {

    const anchorType1 = extractAnchorType(name1);
    const anchorType2 = extractAnchorType(name2);

    if(anchorType1 === anchorType2){
        return schemaCompatibility(name1,name2);
    }

   return false;
}

function schemaCompatibility(name1: string, name2: string): boolean {

    if(name1.includes('merged') || name2.includes('merged')){
        return true;
    }
    // const constraintAnchorType = extractAnchorType(constraintName);
    // Define name equivalence mappings for semantic relationships
    const nameEquivalences: Record<string, string[]> = {
        'x1': ['start_x'],
        'y1': ['start_y'],
        'x2': ['stop_x'],
        'y2': ['stop_y'],
        'markName': ['markName'],
        'text': ['text']
    };
    
    // Reverse mapping for lookup in both directions
    const reverseEquivalences: Record<string, string[]> = {};
    Object.entries(nameEquivalences).forEach(([key, values]) => {
        values.forEach(value => {
            if (!reverseEquivalences[value]) {
                reverseEquivalences[value] = [];
            }
            reverseEquivalences[value].push(key);
        });
    });
    
    
    // Check if both names exist in the equivalence maps but aren't directly equivalent
    const name1InAnyEquivalence = Object.values(nameEquivalences).some(values => values.includes(name1)) || 
                                 Object.keys(nameEquivalences).includes(name1);
    const name2InAnyEquivalence = Object.values(nameEquivalences).some(values => values.includes(name2)) || 
                                 Object.keys(nameEquivalences).includes(name2);
    

    // if both names are in an equvialence map, ensure that they are compatible, else assume they are.
    if (name1InAnyEquivalence && name2InAnyEquivalence) {
        // Find all equivalences for name1
        const name1Equivalences = new Set<string>();
        if (nameEquivalences[name1]) {
            nameEquivalences[name1].forEach(val => name1Equivalences.add(val));
        }
        if (reverseEquivalences[name1]) {
            reverseEquivalences[name1].forEach(val => name1Equivalences.add(val));
        }

        
        if(name1Equivalences.has(name2)){
            return true;
        } else {
            return false;
        }
        
    }
    
    return true;
}

// Merge nested constraints
export const mergeConstraints = (constraints: Constraint[], transformValue: string): string => {
    if(constraints.some(constraint=>constraint.type === ConstraintType.ABSOLUTE)){
        let constraint = constraints.find(constraint=>constraint.type === ConstraintType.ABSOLUTE);
        if(constraint){
            return constraint.value as string;
        }
    }
    if (constraints.length === 0) return transformValue;
    
    // Sort constraints to establish nesting order
    let sortedConstraints = [...constraints].sort((a, b) => {
        // Custom sorting logic if needed
        return 0; // Default no specific order
    });

    // have explicit constraints overrule implicit constraints
    if(sortedConstraints.length !== 1){
        sortedConstraints=sortedConstraints.filter(constraint=>!constraint.isImplicit);
    } else{
        if(sortedConstraints[0].isImplicit){
        }
    }

    
    
    // Nest constraints
    let result = "VGX_TRANSFORM_VALUE";
    for (const constraint of sortedConstraints) {
        result = compileConstraintWithTransform(constraint).replace("VGX_TRANSFORM_VALUE", result);
        
    }
    
    // Replace final placeholder with actual transform value
    return result.replace("VGX_TRANSFORM_VALUE", transformValue);
};


  /**
   * Core function to generate a Vega signal from a configuration
   */
  export function generateSignal(config: SignalConfig): any {
    const { id, transform, output, constraints } = config;



    // Process the transform and generate updates
    let compatibleConstraints = findCompatibleConstraints(transform, constraints);

    // Deduplicate compatible constraints
    // This ensures we don't apply the same constraint multiple times
    const uniqueConstraints = compatibleConstraints.reduce((unique, constraint, index) => {
        // Check if this constraint is already in our unique list
        const isDuplicate = unique.some(existingConstraint => 
            JSON.stringify(existingConstraint) === JSON.stringify(constraint)
        );
        
        if (!isDuplicate) {
            unique.push(constraint);
        }
        
        return unique;
    }, [] as Constraint[]);
    
    // Use the deduplicated constraints for merging
    let mergedExpression = mergeConstraints(uniqueConstraints, transform.value);
    // let mergedExpression = mergeConstraints(compatibleConstraints, transform.value);


    mergedExpression    = mergedExpression.replace(/BASE_NODE_ID/g, id);

    // Extract signal names from the merged expression
    const signalNames = extractSignalNames(mergedExpression);
    
    
    // Create the update object
    const updates = [{
        events: signalNames.map(name => ({ signal: name })),
        update: mergedExpression
    }];
    return {
        name: output,
        value: null,
        update:mergedExpression,
        on: updates
    };
  }


  export function calculateValueFor(key: string, inputContext: CompilationContext, signals: any[]) {
    // find all of the compatible signals for this key

    if(key === 'data'){
        console.log('isdata', signals, inputContext)
    }
    const compatibleSignals = signals.filter(signal => areNamesCompatible(key, generateAnchorId(signal.name)));

    if(compatibleSignals.length > 0){
        //TODO smart find
        return {'expr':compatibleSignals[0].name};
    }


    const compatibleContextKeys = Object.keys(inputContext).filter(contextKey =>
        areNamesCompatible(key, contextKey)
    );


    if (compatibleContextKeys.length > 0) {
        const firstCompatibleKey = compatibleContextKeys[0];
        const values = inputContext[firstCompatibleKey];
        if (Array.isArray(values) && values.length > 0) {
            //TODO ensure no parentId
            return compileConstraint(values[0]);
        }
    }

    // TODO: get base generation for keys working. 
    if(key ==='data'){
        return {'values':[{}]}
    }



    // If all else fails, return null or a sensible default
    return null;

}
  /**
   * Generate signals from a collection of transforms
   * This simplifies the process of creating multiple related signals
   */
  export function generateSignalsFromTransforms(
    transforms: Transform[],
    parentId: string,
    outputPrefix: string,
    constraints: Record<string, Constraint[]>,
  ): any[] {
    return transforms
      .map(transform => {
        const channel = transform.channel;
        if(channel ==='data'){
            return []
        }
        const outputName = `${outputPrefix}_${transform.name || channel}`;
        
        const signal = generateSignal({
          id: parentId,
          transform,
          output: outputName,
          constraints: constraints[channel] || [],
        });
        return signal
      })
      .filter(signal => signal !== null); // Remove any nulls from skipped signals
  }

  
export const generateSignalFromAnchor = (constraints: string[], anchorId: string, transform: string[], mergedParent: string, schemaType: string): any[] => {
    // For Scalar type
    if (schemaType === 'Scalar') {
        return generateScalarSignalFromAnchor(constraints, anchorId, transform[0], mergedParent);
    }
    // For Range type
    else if (schemaType === 'Range') {
        return generateRangeSignalFromAnchor(constraints, anchorId, transform, mergedParent);
    }

    // Default case (should not happen if schema is properly defined)
    console.warn(`Unknown schema type: ${schemaType} for channel ${anchorId}`);
    return [];
}

/**
 * Collapses an array of signal updates into a single Vega update string
 * by recursively replacing SIGNALVAL placeholders with the target value
 * 
 * @param updates Array of update objects with update strings
 * @param target The target signal value to replace SIGNALVAL with
 * @returns A single collapsed update string
 */
export function collapseSignalUpdates(updates: { update: string }[], target: string): string {
    if (!updates || updates.length === 0) {
        return "";
    }

    // For the target, wrap it in parentheses
    const formattedTarget = `(${target})`;

    // Start with the deepest nested update (last in the array)
    let result = updates[updates.length - 1].update;

    // Replace any SIGNALVAL in the deepest update with the formatted target
    if (result.includes("SIGNALVAL")) {
        result = result.replace(/SIGNALVAL/g, formattedTarget);
    }

    // Process remaining updates in reverse order (from deepest to shallowest)
    for (let i = updates.length - 2; i >= 0; i--) {
        const currentUpdate = updates[i].update;

        // Wrap the previous result in parentheses before substituting
        const wrappedResult = `(${result})`;

        // Replace SIGNALVAL with the wrapped result
        result = currentUpdate.replace("SIGNALVAL", wrappedResult);
    }

    return result;
}