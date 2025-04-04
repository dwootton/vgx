import { BaseComponent } from "components/base";

import { TopLevelSpec, UnitSpec } from "vega-lite/build/src/spec";

import { GraphManager } from "./GraphManager";
import {SpecCompiler} from "./SpecCompiler";




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
import { ProcessedGraph } from "./SpecCompiler";
import { extractAnchorType, isAnchorTypeCompatible } from "./cycles";
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

    public getProcessedGraph(id: string): ProcessedGraph {
        return this.specCompiler.getProcessedGraph(id);

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

    public removeComponent(id: string): void {
        this.components.delete(id);
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
        // Check if any input values contain "FAKEPROXY"
        if (sourceId.includes("FAKEPROXY") || targetId.includes("FAKEPROXY") || 
            sourceAnchor.includes("FAKEPROXY") || targetAnchor.includes("FAKEPROXY")) {
            console.log("FAKEPROXY detected in binding:", {
                sourceId,
                targetId,
                sourceAnchor,
                targetAnchor
            });
        }
        // check if the binding already exists
        if (this.bindings.some(binding => binding.sourceId === sourceId && binding.targetId === targetId && binding.sourceAnchor === sourceAnchor && binding.targetAnchor === targetAnchor)) {
            return;
        }

        if(isAnchorTypeCompatible(sourceAnchor, targetAnchor) || (sourceAnchor =='_all' || targetAnchor =='_all')){
            this.bindings.push({ sourceId, targetId, sourceAnchor, targetAnchor });

        } else {
            console.warn('Incompatible binding', sourceId, targetId, sourceAnchor, targetAnchor);
        }
    };

    public removeBinding(sourceId: string, targetId: string, sourceAnchor: string, targetAnchor: string): void {
        this.bindings = this.bindings.filter(binding => binding.sourceId !== sourceId || binding.targetId !== targetId || binding.sourceAnchor !== sourceAnchor || binding.targetAnchor !== targetAnchor);
    }


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


