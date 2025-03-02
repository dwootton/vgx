
export function generateCompiledValue(channel:string){
    return {
        'value': `VGX_SIGNAL_NAME_${channel}`, // min value
    }
}

export const generateSignalFromAnchor = (constraints:string[], channel: string, signalParent:string, mergedParent:string, schemaType: string): any[] => {
    // For Scalar type
    if (schemaType === 'Scalar') {
        const parentExtractor = signalParent + "." + channel;
        const signalName = mergedParent + '_' + channel;
        console.log("CONSTRAINTS", constraints);

        const generateConstraints = (update:string) => {
            return {
                events: {
                    signal: signalName
                },
                update: update.replace(/VGX_SIGNAL_NAME/g, signalName)
            }
        };

        return [{
            name: signalName,
            value: null,
            on: [{
                events: [{
                    signal: signalParent
                }],
                update: parentExtractor
            }, ...(constraints.map(generateConstraints))]
        }];
    }
    // For Range type
    else if (schemaType === 'Range') {
        const startSignalName = mergedParent + '_' + channel + '_start';
        const stopSignalName = mergedParent + '_' + channel + '_stop';
        
        const startParentExtractor = signalParent + "." + channel + ".start";
        const stopParentExtractor = signalParent + "." + channel + ".stop";
        
        const generateStartConstraints = (update:string) => {
            return {
                events: {
                    signal: startSignalName
                },
                update: `${startSignalName} ? ${update.replace(/VGX_SIGNAL_NAME/g, startSignalName)}:${startSignalName} `
            }
        };
        
        const generateStopConstraints = (update:string) => {
            return {
                events: {
                    signal: stopSignalName
                },
                update: `${stopSignalName} ? ${update.replace(/VGX_SIGNAL_NAME/g, stopSignalName)}:${stopSignalName} `
            }
        };
        
        return [
            {
                name: startSignalName,
                value: null,
                expr:startParentExtractor,
                on: [{
                    events: [{
                        signal: signalParent
                    }],
                    update: startParentExtractor
                }, ...(constraints.map(generateStartConstraints))]
            },
            {
                name: stopSignalName,
                value: null,
                expr:stopParentExtractor,
                on: [{
                    events: [{
                        signal: signalParent
                    }],
                    update: stopParentExtractor
                }, ...(constraints.map(generateStopConstraints))]
            }
        ];
    }
    
    // Default case (should not happen if schema is properly defined)
    console.warn(`Unknown schema type: ${schemaType} for channel ${channel}`);
    return [];
}