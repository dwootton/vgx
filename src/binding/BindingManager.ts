import { PortType } from "types/portTypes";
import { BaseComponent } from "../components/base";
import { isPortTypeCompatible } from "./compatabilityUtils";
import { BindingGraph, GraphManager } from "./GraphManager";

/**
 * Interface representing a reference to a port on a component
 */
export interface PortReference {
    componentId: string;
    portGroup: string;
    portType: PortType;
    isInternal: boolean;
}

/**
 * Type representing the role of a binding in the system
 */
export type BindingRole = 'translate' | 'direct' | 'midpoint';

/**
 * Interface representing metadata about a binding
 */
export interface BindingMetaData {
   role: BindingRole;
   isImplicit: boolean;
}

export interface BindingEdge {
    source: PortReference;
    target: PortReference;
    metadata?: Record<string, any>;
}
// /**
//  * Interface representing an edge between components
//  */
// export interface Edge {
//    source: PortReference;
//    target: PortReference;
//    metaData: BindingMetaData;
// }

/**
 * Class representing a binding edge between components.
 * Provides utility methods for comparing and manipulating bindings.
 */
export class BindingEdge implements BindingEdge {
    source: PortReference;
    target: PortReference;
    metaData: BindingMetaData;

    constructor(source: PortReference, target: PortReference, metaData: BindingMetaData= {role:'direct',isImplicit:false}) {
        this.source = source;
        this.target = target;
        this.metaData = metaData;
    }

    /**
     * Checks if this binding is equal to another binding.
     * Two bindings are considered equal if they have the same source and target.
     */
    isEqual(other: BindingEdge): boolean {
        return this.isEqualSource(other.source) && this.isEqualTarget(other.target);
    }

    /**
     * Checks if this binding has the same source as the provided source.
     */
    isEqualSource(source: PortReference): boolean {
        return this.source.componentId === source.componentId &&
               this.source.portGroup === source.portGroup &&
               this.source.portType === source.portType;
    }

    /**
     * Checks if this binding has the same target as the provided target.
     */
    isEqualTarget(target: PortReference): boolean {
        return this.target.componentId === target.componentId &&
               this.target.portGroup === target.portGroup &&
               this.target.portType === target.portType;
    }

    /**
     * Checks if this binding involves a specific component (as source, target, or both).
     */
    involvesComponent(componentId: string, type: 'source' | 'target' | 'both' = 'both'): boolean {
        switch (type) {
            case 'source':
                return this.source.componentId === componentId;
            case 'target':
                return this.target.componentId === componentId;
            case 'both':
                return this.source.componentId === componentId || this.target.componentId === componentId;
        }
    }

    /**
     * Checks if the binding is compatible based on port types.
     */
    isCompatible(): boolean {
        return isPortTypeCompatible(this.source.portType, this.target.portType);
    }

    /**
     * Creates a clone of this binding.
     */
    clone(): BindingEdge {
        return new BindingEdge(
            { ...this.source },
            { ...this.target },
            { ...this.metaData }
        );
    }

    /**
     * Returns a string representation of this binding.
     */
    toString(): string {
        return `${this.source.componentId}.${this.source.portType} → ${this.target.componentId}.${this.target.portType}`;
    }
}


/**
 * Singleton class responsible for managing components and their bindings
 */
export class BindingManager {
    private static instance: BindingManager;
    private components: Array<BaseComponent>;
    private bindings: Array<BindingEdge>;
    // private graphManager: GraphManager;

    constructor() {
        this.components = new Array<BaseComponent>();
        this.bindings = [];
        // this.graphManager = new GraphManager(() => this);
    }

    /**
     * Get the singleton instance of BindingManager
     */
    public static getInstance(): BindingManager {
        if (!BindingManager.instance) {
            BindingManager.instance = new BindingManager();
        }
        return BindingManager.instance;
    }

    // Components
    /**
     * Get all registered components
     */
    public getComponents(): Array<BaseComponent> {
        return Array.from(this.components.values());
    }

    /**
     * Get a component by its ID
     */
    public getComponent(componentId: string): BaseComponent {
        const component = this.components.find(component => component.getId() === componentId);
        if (!component) {
            throw new Error(`Component "${componentId}" not found.`);
        }
        return component;
    }

    /**
     * Add a component to the system
     */
    public addComponent(component: BaseComponent): void {
        this.components.push(component);
    }

    /**
     * Remove a component from the system
     */
    public removeComponent(componentId: string): void {
        this.components = this.components.filter(component => component.getId() !== componentId);
        this.bindings = this.bindings.filter(binding =>
            binding.source.componentId !== componentId &&
            binding.target.componentId !== componentId
        );
    }

    // Bindings 
    /**
     * Get all bindings in the system
     */
    public getBindings(): BindingEdge[] {
        return this.bindings;
    }

    /**
     * Get bindings related to a specific component
     */
    public getBindingsForComponent(componentId: string, role: 'source' | 'target' | 'both' = 'both'): BindingEdge[] {
        return this.bindings.filter(binding => {
            if (role === 'source') return binding.source.componentId === componentId;
            if (role === 'target') return binding.target.componentId === componentId;
            return binding.source.componentId === componentId || binding.target.componentId === componentId;
        });
    }

    /**
     * Add a binding between two components
     */
    public addBinding(
        sourceId: string,
        targetId: string,
        sourceportGroup: string,
        targetportGroup: string,
        sourcePortType: PortType,
        targetPortType: PortType,
        sourceIsInternal: boolean = false,
        targetIsInternal: boolean = false,
        // no metadata as any calling of addBinding means that the role is explicitly not implicit
    ): void {
        const binding: BindingEdge = new BindingEdge(
            {
                componentId: sourceId,
                portGroup: sourceportGroup,
                portType: sourcePortType,
                isInternal: sourceIsInternal
            },
            {
                componentId: targetId,
                portGroup: targetportGroup,
                portType: targetPortType,
                isInternal: targetIsInternal
            },
        );
        // Check if a similar binding already exists
        const existingBinding = this.bindings.find(existing=>binding.isEqual(existing));

        if (existingBinding) {
            return; // Skip adding duplicate binding
        }
        
        this.bindings.push(binding);
    }

    /**
     * Remove a specific binding
     */
    public removeBinding(binding: BindingEdge): void {
        const index = this.bindings.findIndex(existing=>binding.isEqual(existing));
        if (index !== -1) {
            this.bindings.splice(index, 1);
        }
    }
}
