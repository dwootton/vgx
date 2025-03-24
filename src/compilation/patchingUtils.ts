import { extractAnchorType } from "../binding/cycles";
import { TopLevelSpec } from "vega-lite/build/src/spec";
import { VariableParameter } from "vega-lite/build/src/parameter";
import { TopLevelSelectionParameter } from "vega-lite/build/src/selection"
type Parameter = VariableParameter | TopLevelSelectionParameter


function stripVGXMOD(name: string) {
    return name.replace('VGXMOD_', '')
}

type ModifiedElements = {
    data: any[],
    params: any[],
    scales: any[]
}
export function extractModifiedObjects(spec: TopLevelSpec): ModifiedElements {
    const result: ModifiedElements = { data: [], params: [], scales: []};

    function extractDatasets(spec: any) {
        if (spec.data && spec.data?.name?.startsWith('VGXMOD_')) {

            const datasets = (Array.isArray(spec.data) ? spec.data : [spec.data]).map(dataset => ({
                ...dataset,
                name: stripVGXMOD(dataset.name)
            }));

            // result.data = result.data || [];
            result.data.push(...datasets);
            spec.data = {
                name: stripVGXMOD(spec.data.name),
            }
        }
    }

    function extractParams(spec: any) {
        if (spec.params) {
            spec.params=spec.params.filter(param => {
                if (param.name?.startsWith('VGXMOD_')) {
                    result.params.push({
                        ...param,
                        name: stripVGXMOD(param.name)
                    });
                    return false;
                }
                return true;
            })

            // const params = (Array.isArray(spec.params) ? spec.params : [spec.params]).map(param => ({
            //     ...param,
            //     name: stripVGXMOD(param.name)
            // }));
            // // result.params = result.params || [];
            // result.params.push(...params);
        }
    }
    
    // Helper function to recursively extract datasets from nested specs
    function extractFromSpec(currentSpec: any, extractorFn: (spec: any) => void) {

        extractorFn(currentSpec)
        
    

        
        // Check in layers
        if (currentSpec.layer) {
            for (const layer of currentSpec.layer) {
                extractFromSpec(layer, extractorFn);
            }
        }
        
        // Check in hconcat
        if (currentSpec.hconcat) {
            for (const view of currentSpec.hconcat) {
                extractFromSpec(view, extractorFn);
            }
        }
        
        // Check in vconcat
        if (currentSpec.vconcat) {
            for (const view of currentSpec.vconcat) {
                extractFromSpec(view, extractorFn);
            }
        }
        
        // Check in concat
        if (currentSpec.concat) {
            for (const view of currentSpec.concat) {
                extractFromSpec(view, extractorFn);
            }
        }
    }

   

    console.log('preextracted   ',JSON.parse(JSON.stringify(spec, null, 2)));
    extractFromSpec(spec, extractDatasets);
    extractFromSpec(spec, extractParams);
    console.log('postextracted   ',JSON.parse(JSON.stringify(spec, null, 2)));
    return result;
}



export function removeUnreferencedParams(spec: TopLevelSpec) {
    // Stringify the spec (omitting data) to search for parameter usage
    const specString = JSON.stringify(spec, (key, value) => {
        // Skip data values to reduce size
        if (key === 'values' && Array.isArray(value)) {
            return '[...]';
        }
        return value;
    });

    // Check if each parameter is actually used in expressions
    const usedParams = spec.params?.filter(param => {
        const paramName = param.name;
        if (paramName.includes('VGXMOD_')) {
            return true;
        }
        // Look for the parameter name within expression strings
        // Match both 'paramName' and "paramName" patterns
        const singleQuotePattern = `'${paramName}'`;
        const doubleQuotePattern = `"${paramName}"`;

        // Also match direct references to the parameter in expressions
        const directRefPattern = new RegExp(`\\b${paramName}\\b`);

        // Count occurrences to ensure parameter is used at least twice
        // Create a copy of the string to avoid modifying the original
        let tempString = specString;
        
        // Find and count single quote matches, then remove them from temp string
        const singleQuoteRegex = new RegExp(singleQuotePattern, 'g');
        const singleQuoteMatches = (tempString.match(singleQuoteRegex) || []).length;
        tempString = tempString.replace(singleQuoteRegex, '');
        
        // Find and count double quote matches, then remove them from temp string
        const doubleQuoteRegex = new RegExp(doubleQuotePattern, 'g');
        const doubleQuoteMatches = (tempString.match(doubleQuoteRegex) || []).length;
        tempString = tempString.replace(doubleQuoteRegex, '');
        
        // Finally count direct references in the remaining string
        const directRefMatches = (tempString.match(directRefPattern) || []).length;
        // console.log('directRefMatches', paramName, directRefMatches)
       

        const totalOccurrences = singleQuoteMatches + doubleQuoteMatches + directRefMatches;
        if(totalOccurrences <2){
            console.log('removing unused param:', paramName, ' used:',totalOccurrences)
        }
        // console.log('directRefMatches total:', totalOccurrences, 'from:',directRefMatches, singleQuoteMatches, doubleQuoteMatches)
        return totalOccurrences >= 2;
    }) || [];

    return {
        ...spec,
        params: usedParams
    }
}


export function removeUndefinedInSpec(obj: TopLevelSpec): TopLevelSpec {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefinedInSpec(item)).filter(item => item !== undefined) as any;
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;

        const cleanValue = removeUndefinedInSpec(value);
        if (cleanValue !== undefined) {
            result[key] = cleanValue;
        }
    }
    return result;
}



/*

 Temporary fix for the issue where start span parameters don't seem to update?
 Looks like it isn't detecting changing with node_start, and thus it doesn't update it, even when 
 a new drag occurs. 

*/
export function fixVegaSpanBug(params: Parameter[]) :Parameter[]{
    for (let i = 0; i < params.length; i++) {
        const param = params[i];
        
        
        // Check if this is a span start parameter for any dimension (x or y)

        //TOD include param.name.endsWith('begin_x') || param.name.endsWith('begin_y')
        if (param.name.endsWith('_start_x') || param.name.endsWith('_start_y') 
            ) {
         
            // Extract the dimension from the parameter name
            let dimension, startType;
            
            if (param.name.endsWith('_start_x') || param.name.endsWith('_start_y')) {
                dimension = param.name.endsWith('_start_x') ? 'x' : 'y';
                startType = 'start';
            } else if (param.name.endsWith('_begin_x') || param.name.endsWith('_begin_y')) {
                dimension = param.name.endsWith('_begin_x') ? 'x' : 'y';
                startType = 'begin';
            } else {
                // Fallback to extracting channel if the pattern doesn't match
                const channel = extractAnchorType(param.name);
                dimension = channel === 'x' ? 'x' : 'y';
                startType = param.name.includes('_start') ? 'start' : 'begin';
            }

            const baseName = startType === 'start' ? 
                param.name.split(`_start_${dimension}`)[0] : 
                param.name.split(`_begin_${dimension}`)[0];
            
            // Find the corresponding stop parameter
            const stopParamName = baseName + (startType === 'start' ? `_stop_${dimension}` : `_point_${dimension}`);
            // Find the corresponding stop parameter
            // const stopParamName = `${nodeId}_span_${dimension}_stop`;
            
            // Ensure the param has an 'on' array
            if (!param.on) {
                param.on = [];
            }
            
            // If there's already an event handler, add to it
            if (param.on.length > 0) {
                // Add the stop parameter to the events if it's not already there
                if (!param.on[0].events.signal || !param.on[0].events.signal.includes(stopParamName)) {
                    if (!Array.isArray(param.on[0].events)) {
                        const pastObject = param.on[0].events;

                        param.on[0].events = [ { signal: stopParamName }];
                        if (pastObject) {
                            param.on[0].events.push(pastObject);
                        }
                        
                    } else {
                        param.on[0].events.push({signal:stopParamName});

                       
                    }
                }
            } else {
                // A scale parameter doesn't have an on array
                // // Create a new event handler
                // param.on.push({
                //     events: { signal: stopParamName },
                //     update: param.update || param.value
                // });
            }
        }
    }
    return params;
}