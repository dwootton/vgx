import { TopLevelSpec } from "vega-lite/build/src/spec";
import { extractModifiedObjects ,removeUndefinedInSpec, fixVegaSpanBug, removeUnreferencedParams} from "./patchingUtils";
import * as vl from "vega-lite";

export class VegaPatchManager {
    private spec: TopLevelSpec;
    private modifiedElements: {data: any[], params: any[], scales: any[]};
    constructor(spec: TopLevelSpec) {
        this.spec = spec;

        console.log('preunreferencedRemoved', spec)

        

        const createBaseSignals = (params: any[]) => {
            const baseSignals: any[] = [];
            
            // Find all params that might reference base_ signals
            const paramsStr = JSON.stringify(params);
            const baseMatches = paramsStr.match(/base_[a-zA-Z0-9_]+/g) || [];
            const uniqueBaseSignals = [...new Set(baseMatches)];
            
            console.log('uniqueBaseSignals', uniqueBaseSignals);
            // Create base signals for each unique match
            uniqueBaseSignals.forEach(baseSignalName => {
                // Find the original param if it exists
                const originalParam = params.find(p => p.name === baseSignalName.replace('base_', ''));
                console.log('baseSignalsParam', originalParam);
                // Create a new base signal with minimal properties
                const baseSignal: any = {
                    name: baseSignalName,
                    value: originalParam?.value || null,
                    // on: originalParam?.on || null,
                    init: originalParam?.update || null
                };
                
                
                baseSignals.push(baseSignal);
            });
            console.log('baseSignals', baseSignals);
            
            return baseSignals;
        }

        const baseSignals = createBaseSignals(spec.params || []);
        // Add base signals to spec.params if they have values
        if (baseSignals.length > 0) {
            console.log('creating baseSignals', baseSignals);
            // Initialize params array if it doesn't exist
            if (!spec.params) {
                spec.params = [];
            }
            
            // Add each base signal with a value to the params
            baseSignals.forEach(baseSignal => {
                // if (baseSignal.value !== null && baseSignal.value !== undefined) {
                    spec.params.push(baseSignal);
                // }
            });
            console.log('spec.params', spec.params);
        }


        console.log('baseSignals', baseSignals)
        console.log('unreferencedRemoved(undefinedRemoved)', spec)
        const undefinedRemoved = removeUndefinedInSpec(spec);

        console.log('unreferencedRemoved(postundefinedRemoved)', undefinedRemoved)

        // const unreferencedRemovedFirst = removeUnreferencedParams(undefinedRemoved);
        const unreferencedRemoved = removeUnreferencedParams(undefinedRemoved);
        console.log('unreferencedRemoved', unreferencedRemoved)


        this.modifiedElements = extractModifiedObjects(unreferencedRemoved);



        const newParams = fixVegaSpanBug(unreferencedRemoved.params)
        unreferencedRemoved.params = newParams


        // add reference to dataset
        if(this.modifiedElements.data.length > 0){
            unreferencedRemoved.datasets = unreferencedRemoved.datasets || {}
            this.modifiedElements.data.forEach(dataset => {
                unreferencedRemoved.datasets[dataset.name] = []
            })
        }
        // console.log

        this.spec = unreferencedRemoved;


    }

    public compile(){
        console.log('compile vl2', this.spec)
        const vegaCompilation = vl.compile(this.spec);
        vegaCompilation.spec.padding = 40;

        console.log('post compilation', vegaCompilation.spec.data, this.modifiedElements.data, this.modifiedElements.params)


        console.log('matchingModifiedData', vegaCompilation.spec.data, this.modifiedElements.data, this.modifiedElements.params)

         // Update data elements that match modified elements
         if (vegaCompilation.spec.data && this.modifiedElements.data && Array.isArray(this.modifiedElements.data) && this.modifiedElements.data.length > 0) {
                            // console.log('matchingModifiedData', matchingModifiedData, vegaCompilation.spec.data)

            vegaCompilation.spec.data = vegaCompilation.spec.data.map(dataElement => {
                const matchingModifiedData = this.modifiedElements.data.find(
                    modifiedData => modifiedData.name === dataElement.name
                );
                
                console.log('matchingModifiedData', matchingModifiedData, vegaCompilation.spec.data)

               
                if (matchingModifiedData) {
                    return matchingModifiedData ;
                }
                console.log('matchingModifiedData', matchingModifiedData)
                
                return dataElement;
            });
            
            // Move modified elements to the last position in the array
            vegaCompilation.spec.data.sort((a, b) => {
                const aIsModified = this.modifiedElements.data.some(d => d.name === a.name);
                const bIsModified = this.modifiedElements.data.some(d => d.name === b.name);
                if (aIsModified && !bIsModified) return 1;
                if (!aIsModified && bIsModified) return -1;
                return 0;
            });
        }


        // Update signals that match modified params
        if (vegaCompilation.spec.signals && this.modifiedElements.params.length > 0) {
            vegaCompilation.spec.signals = vegaCompilation.spec.signals.map(signal => {
                const matchingParam = this.modifiedElements.params.find(
                    param => param.name === signal.name
                );
                
                if (matchingParam && matchingParam.on && signal.on) {
                    // Create a new signal with merged 'on' arrays
                    return {
                        ...signal,
                        on: [...signal.on, ...matchingParam.on]
                    };
                }
                
                return signal;
            });
        }
        return vegaCompilation;
    }
    
}