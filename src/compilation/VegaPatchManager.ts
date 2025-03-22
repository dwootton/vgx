import { TopLevelSpec } from "vega-lite/build/src/spec";
import { extractModifiedObjects ,removeUndefinedInSpec, fixVegaSpanBug, removeUnreferencedParams} from "./patchingUtils";
import * as vl from "vega-lite";

export class VegaPatchManager {
    private spec: TopLevelSpec;
    private modifiedElements: {data: any[], params: any[], scales: any[]};
    constructor(spec: TopLevelSpec) {
        this.spec = spec;

        this.modifiedElements = extractModifiedObjects(spec);
        //TODO CLENAUP:
        //TODO stop from removing undefined with data
        const undefinedRemoved = removeUndefinedInSpec(spec);
        const unreferencedRemoved = removeUnreferencedParams(undefinedRemoved);

        const newParams = fixVegaSpanBug(unreferencedRemoved.params)
        unreferencedRemoved.params = newParams


        // add reference to dataset
        if(this.modifiedElements.data.length > 0){
            unreferencedRemoved.datasets = unreferencedRemoved.datasets || {}
            this.modifiedElements.data.forEach(dataset => {
                console.log(`Added placeholder dataset: ${dataset.name}`);
                unreferencedRemoved.datasets[dataset.name] = []
            })
        }

        this.spec = unreferencedRemoved;


    }

    public compile(){
        const vegaCompilation = vl.compile(this.spec);

        console.log('vegaCompilation', vegaCompilation)
        console.log('modifiedElements', this.modifiedElements)


         // Update data elements that match modified elements
         if (vegaCompilation.spec.data && this.modifiedElements.data && Array.isArray(this.modifiedElements.data) && this.modifiedElements.data.length > 0) {
            vegaCompilation.spec.data = vegaCompilation.spec.data.map(dataElement => {
                const matchingModifiedData = this.modifiedElements.data.find(
                    modifiedData => modifiedData.name === dataElement.name
                );
                
                if (matchingModifiedData) {
                    console.log(`Updating data element: ${dataElement.name} with modified data`,matchingModifiedData);
                    return matchingModifiedData ;
                }
                
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

        console.log('vegaCompilation.spec.data', vegaCompilation.spec.data)

        // Update signals that match modified params
        if (vegaCompilation.spec.signals && this.modifiedElements.params.length > 0) {
            vegaCompilation.spec.signals = vegaCompilation.spec.signals.map(signal => {
                const matchingParam = this.modifiedElements.params.find(
                    param => param.name === signal.name
                );
                
                if (matchingParam && matchingParam.on && signal.on) {
                    console.log(`Merging signal handlers for: ${signal.name}`);
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