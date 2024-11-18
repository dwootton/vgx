import { BaseComponent, Component } from "components/base";
import { AnchorId, AnchorOrGroupSchema, AnchorProxy } from "./anchors";
import { TopLevelUnitSpec, UnitSpec } from 'vega-lite/build/src/spec/unit';
import { Field } from "vega-lite/build/src/channeldef";

export type CompilationContext = { 
    binding: Binding;
    spec: Partial<UnitSpec<Field>>;
  }

  
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

export interface Placeholder {
    property: string;
    componentId: string;
}

export interface Generator {
    componentId: string;
    generatedProperties: Record<string, any>; // Maps property names to generated data
}

export interface CompilationQuery {
    query: (bndingTree: BindingTree) => any;
    result: any;
}

export interface TopLevelSpecWithParams extends TopLevelUnitSpec<Field> {
    $schema: string;
    params?: any[];
    layer?: any[]; // If the result is merged as a layered spec
}
