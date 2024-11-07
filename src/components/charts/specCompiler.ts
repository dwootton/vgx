import { BindingGraph } from '../../utils/bindingGraph';
import { Binding, CompilationResult } from '../../types/compilation';
import { Anchor, AnchorOrGroup, AnchorProxy } from '../../types/anchors';
import { BaseComponent } from '../base';
import { CompilationContext, ParentInfo } from '../../types/compilation';
import { BindingStore } from '../../utils/bindingStore';

export class SpecCompiler {
    private bindingGraph: BindingGraph;
    private bindingStore: BindingStore;

    constructor() {
        this.bindingStore = BindingStore.getInstance();
        this.bindingGraph = this.bindingStore.getDefaultGraph();
    }

    compile(rootComponent: BaseComponent): CompilationResult {
        const context: CompilationContext = {
            bindings: this.bindingGraph.getBindings(),
            compiledComponents: new Set()
        };

        // Start compilation from root
        return this.compileComponent(rootComponent, context);
    }

    private compileComponent(
        component: BaseComponent,
        context: CompilationContext,
        parentInfo?: ParentInfo
    ): CompilationResult {
        // Don't recompile components
        if (context.compiledComponents.has(component.id)) {
            return {};
        }

        // Mark as compiled
        context.compiledComponents.add(component.id);

        // Compile the component itself with its parent info
        const componentResult = component.compileComponent(context, parentInfo);

        // Find and compile all children
        const childBindings = context.bindings.filter(b =>
            b.source.componentId === component.id
        );

        const childResults = childBindings.map(binding => {
            const childComponent = this.getComponent(binding.target.componentId);
            if (!childComponent) return {};

            const childParentInfo: ParentInfo = {
                boundAnchor: this.getAnchor(binding),
                parentComponent: component
            };

            return this.compileComponent(childComponent, context, childParentInfo);
        });

        // Merge all results into a single CompilationResult
        return this.mergeResults(componentResult, ...childResults);
    }


    public getComponent(componentId: string): BaseComponent | undefined {
        // Use BaseComponent's static component registry
        return this.bindingStore.getComponent(componentId);
    }

    private getAnchor(binding: Binding): AnchorProxy {
        const sourceComponent = this.getComponent(binding.source.componentId);
        if (!sourceComponent) {
            throw new Error(`Component ${binding.source.componentId} not found`);
        }

        const anchor = sourceComponent.anchors.get(binding.source.anchorId);
        if (!anchor) {
            throw new Error(`Anchor ${binding.source.anchorId} not found on component ${binding.source.componentId}`);
        }

        return anchor;
    }



    private mergeResults(...results: any[]): any {
        // Merge Vega-Lite specs
        // Implementation depends on what compile() returns
        return results.reduce((merged, result) => ({
            ...merged,
            ...result
        }), {});
    }
}