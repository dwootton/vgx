import { BaseComponent } from "components/base";
import { AnchorGroupSchema, AnchorProxy, AnchorIdentifer } from "types/anchors";
import { Field } from "vega-lite/build/src/channeldef";
import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext, deduplicateById, validateComponent, removeUndefinedInSpec, logComponentInfo, detectAndMergeSuperNodes, resolveAnchorValue } from "./binding";
import { getProxyAnchor } from '../utils/anchorProxy';
import { VariableParameter } from "vega-lite/build/src/parameter";
import { TopLevelSelectionParameter } from "vega-lite/build/src/selection"
import { getChannelFromEncoding } from "../utils/anchorGeneration/rectAnchors";
import { BindingEdge, GraphManager } from "./GraphManager";
import {SpecCompiler} from "./SpecCompiler";

type Parameter = VariableParameter | TopLevelSelectionParameter



export interface VirtualBindingEdge {
    channel: string;
    value: any;
    source: 'context' | 'baseContext' | 'generated';
}

interface Binding {
    sourceId: string;
    targetId: string;
    sourceAnchor: string;
    targetAnchor: string;
}

export class BindingManager {
    private static instance: BindingManager;
    private graphManager: GraphManager;
    private specCompiler: SpecCompiler;

    private components: Map<string, BaseComponent> = new Map();
    private bindings: Binding[] = [];
    private virtualBindings: Map<string, VirtualBindingEdge> = new Map();

    private constructor() {
        // Initialize dependencies lazily
        this.graphManager = new GraphManager(() => this);
        this.specCompiler = new SpecCompiler(this.graphManager, () => this);
    }

    public static getInstance(): BindingManager {
        if (!BindingManager.instance) {
            BindingManager.instance = new BindingManager();
        }
        return BindingManager.instance;
    }

    // Components
    public getComponents(): Map<string, BaseComponent> {
        return this.components;
    }

    public getComponent(id: string): BaseComponent {
        const component = this.components.get(id);
        if (!component) {
            throw new Error(`Component "${id}" not found.`);
        }
        return component;
    }

    public addComponent(component: BaseComponent): void {
        this.components.set(component.id, component);
    }


    // Bindings 
    public getBindings(): Binding[] {
        return this.bindings;
    }

    public getBindingsForComponent(componentId: string, type?: 'source' | 'target' | 'both'): Binding[] {
        return this.bindings.filter(binding => {
            switch (type) {
                case 'source':
                    return binding.sourceId === componentId;
                case 'target':
                    return binding.targetId === componentId;
                case 'both':
                default:
                    return binding.sourceId === componentId || binding.targetId === componentId;
            }
        });
    }

    public addBinding(sourceId: string, targetId: string, sourceAnchor: string, targetAnchor: string): void {
        this.bindings.push({ sourceId, targetId, sourceAnchor, targetAnchor });
    };


    /* 
    Virtual Bindings are bindings that come from configurations, they pass in data
    but they do not have a source component. Often, they are used to set initial values
    */
    public addVirtualBinding(channel: string, virtualBinding: VirtualBindingEdge): void {
        this.virtualBindings.set(channel, virtualBinding);
    }

    public getVirtualBindings(): Map<string, VirtualBindingEdge> {
        return this.virtualBindings;
    }

    public compile(fromComponentId: string): TopLevelSpec {
        return this.specCompiler.compile(fromComponentId);
    }
}



function mergeSpecs(specs: Partial<UnitSpec<Field>>[], rootComponentId: string): TopLevelSpec {
    // Helper to check if spec has layer/mark
    const hasLayerOrMark = (spec: any) => {
        return spec.layer || spec.mark;
    };


    // First merge specs, handling layers
    const mergedSpec = specs.reduce((merged: any, spec) => {
        // If either has layer/mark, create layer spec
        if (hasLayerOrMark(merged) && hasLayerOrMark(spec)) {
            return {
                layer: [
                    merged,
                    spec
                ]
            };
        }

        // Otherwise merge normally
        return {
            ...merged,
            ...spec,
            // Concatenate params if they exist
            params: [
                ...(merged.params || []),
                ...(spec.params || [])
            ]
        };
    }, {});

    // Move all params to top level
    const params: (Parameter)[] = [];
    const selectParams: (Parameter)[] = [];

    // Function to find base chart layer by rootComponentId
    const findBaseChartLayer = (obj: any): any | null => {
        if (!obj || typeof obj !== 'object') return null;

        if (obj.name === rootComponentId) return obj;

        for (const value of Object.values(obj)) {
            const result = findBaseChartLayer(value);
            if (result) return result;
        }

        return null;
    };

    // Function to move params to top level
    const moveParamsToTop = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;

        if (obj.params && Array.isArray(obj.params)) {
            // Split params into select and non-select
            const [selectParamsArr, nonSelectParamsArr] = obj.params.reduce(
                ([select, nonSelect]: [Parameter[], Parameter[]], param: Parameter) => {
                    if ('select' in param) {
                        select.push(param);
                    } else {
                        nonSelect.push(param);
                    }
                    return [select, nonSelect];
                },
                [[], []]
            );

            // Add to respective arrays
            if (nonSelectParamsArr.length > 0) {
                params.push(...nonSelectParamsArr);
            }
            if (selectParamsArr.length > 0) {
                selectParams.push(...selectParamsArr);
            }

            // Remove params from original location
            delete obj.params;
        }

        Object.values(obj).forEach(value => {
            moveParamsToTop(value);
        });
    };

    // Move params to their destinations
    moveParamsToTop(mergedSpec);

    // Add select params to base chart
    const baseChartLayer = findBaseChartLayer(mergedSpec);
    if (baseChartLayer && selectParams.length > 0) {
        baseChartLayer.params = selectParams;
    }
    if (params.length > 0) {

        mergedSpec.params = mergeParams(params);
    }

    return mergedSpec;
}

function mergeParams(params: any[]): any[] {
    const paramsByName = new Map<string, any>();

    // Group params by name
    params.forEach(param => {
        if (!param.name) return;

        if (paramsByName.has(param.name)) {
            // Merge with existing param
            const existing = paramsByName.get(param.name);
            paramsByName.set(param.name, {
                ...existing,
                ...param
            });
        } else {
            paramsByName.set(param.name, param);
        }
    });

    return Array.from(paramsByName.values());
}

