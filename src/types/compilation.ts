import { BaseComponent } from "components/base";
import { AnchorId, AnchorOrGroupSchema, AnchorProxy } from "./anchors";
import { TopLevelUnitSpec } from 'vega-lite/build/src/spec/unit';
import { Field } from "vega-lite/build/src/channeldef";
export interface ComponentRef {
    componentId: string;
    anchorId: string; // Stores which anchor was used in the binding
}

export interface Binding {
    id: string;
    parentAnchorId: AnchorId;
    childAnchorId: AnchorId;
    // source: ComponentRef;
    // target: ComponentRef;
}

export interface ParentInfo {
    childAnchor: AnchorProxy;
    parentAnchor: AnchorProxy;
    parentComponent: BaseComponent;
}

export interface CompilationContext {
    bindings: Binding[];
    compiledComponents: Set<string>;
    placeholders: Placeholder[]; // New addition to track placeholders
    generators: Generator[]; // New addition to track generators
}

export interface Placeholder {
    property: string;
    componentId: string;
}

export interface Generator {
    componentId: string;
    generatedProperties: Record<string, any>; // Maps property names to generated data
}

export interface CompilationResult {
    componentId: string;
    binding:Binding;
    // Each component can return a partial unit spec
    spec?: Partial<TopLevelUnitSpec<Field>>;
    generatedData?: Record<string, any>; // Holds data generated by the component
    placeholders?: Placeholder[]; // List of placeholders this component has
    generators?: Generator[]; // List of generators from the component
}

export interface TopLevelSpecWithParams extends TopLevelUnitSpec<Field> {
    $schema: string;
    params?: any[];
    layer?: any[]; // If the result is merged as a layered spec
}
