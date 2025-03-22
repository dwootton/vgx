import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import * as vl from "vega-lite";

export class VLPatchCompiler {
    private extractedDatasets: any[] = [];
    private extractedSignals: any[] = [];

    public compileWithPatches(spec: TopLevelSpec): TopLevelSpec {
        // Step 1: Extract VGXMOD_ items
        const cleanedSpec = this.extractVGXMODItems(spec);

        // Step 2: Compile with Vega-Lite
        const vegaSpec = vl.compile(cleanedSpec).spec;

        // Step 3: Apply patches
        return this.applyPatches(vegaSpec);
    }

    private extractVGXMODItems(spec: TopLevelSpec): TopLevelSpec {
        // Handle datasets
        if (spec.data) {
            spec.data = spec.data.map(dataset => {
                if (dataset.name?.startsWith('VGXMOD_')) {
                    this.extractedDatasets.push(dataset);
                    return { name: dataset.name };
                }
                return dataset;
            });
        }

        // Handle signals
        if (spec.signals) {
            spec.signals = spec.signals.filter(signal => {
                if (signal.name?.startsWith('VGXMOD_')) {
                    this.extractedSignals.push(signal);
                    return false;
                }
                return true;
            });
        }

        // Handle nested specs (e.g., in layered or concatenated charts)
        if (spec.layer) {
            spec.layer = spec.layer.map(layer => this.extractVGXMODItems(layer));
        }
        if (spec.hconcat) {
            spec.hconcat = spec.hconcat.map(h => this.extractVGXMODItems(h));
        }
        if (spec.vconcat) {
            spec.vconcat = spec.vconcat.map(v => this.extractVGXMODItems(v));
        }

        return spec;
    }

    private applyPatches(vegaSpec: TopLevelSpec): TopLevelSpec {
        // Add extracted datasets
        if (this.extractedDatasets.length > 0) {
            vegaSpec.data = vegaSpec.data || [];
            vegaSpec.data.push(...this.extractedDatasets);
        }

        // Add extracted signals
        if (this.extractedSignals.length > 0) {
            vegaSpec.signals = vegaSpec.signals || [];
            vegaSpec.signals.push(...this.extractedSignals);
        }

        return vegaSpec;
    }
} 