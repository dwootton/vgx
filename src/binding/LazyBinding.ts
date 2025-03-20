import { BaseComponent } from "../components/base";
import { BindingManager } from "./BindingManager";

type LazyOperation = {
    type: 'count' | 'filter' | 'groupby' | 'percent';
    args: any[];
}
let fakeProxyCounter = 0;

export class LazyComponent {
    id: string;
    componentType: string;
    operations: LazyOperation[];

    constructor(componentType: string, operations: LazyOperation[] = []) {
        this.id = `FAKEPROXY_${fakeProxyCounter++}`;
        this.componentType = componentType;
        this.operations = operations;
    }

    bind(parentComponent: BaseComponent, propertyName: string): void {
        const bindingManager = BindingManager.getInstance();

        // Create temporary binding to the fake proxy
        bindingManager.addBinding(
            parentComponent.id,
            this.id,
            propertyName,
            'data' // Default anchor for data access
        );
    }
}

export class LazyBindingRegistry {
    private static pendingBindings: Map<string, LazyComponent[]> = new Map();
    private static bindingManager = BindingManager.getInstance();

    static register(lazyComponent: LazyComponent): void {
        const componentType = lazyComponent.componentType;
        if (!this.pendingBindings.has(componentType)) {
            this.pendingBindings.set(componentType, []);
        }
        this.pendingBindings.get(componentType)!.push(lazyComponent);
    }

    static resolve(componentType: string, realComponent: BaseComponent): void {
        const pending = this.pendingBindings.get(componentType) || [];

        console.log("RESOLVINGNEW", pending, 'on:', realComponent, this.pendingBindings, componentType)
        if (pending.length == 0) {
            return;
        }
        // Process each pending lazy component
        pending.forEach(lazyComponent => {
            // Find all bindings to the fake proxy
            const bindings = this.bindingManager.getBindingsForComponent(lazyComponent.id, 'target');

            console.log("BINDINGS", bindings, lazyComponent.id, this.bindingManager.getBindings())
            // Rewrite each binding to point to the real component
            bindings.forEach(binding => {
                // Remove the old binding
                this.bindingManager.removeBinding(
                    binding.sourceId,
                    binding.targetId,
                    binding.sourceAnchor,
                    binding.targetAnchor
                );

                // Apply operations to get the final value
                let value = realComponent;
                console.log("RESOLVINGVIA REAL COMPONENT", lazyComponent.operations, 'on:', realComponent)
                for (const op of lazyComponent.operations) {
                    if (value && value[op.type]) {
                        if (op.args) {
                            value = value[op.type](...op.args);
                        } else {
                            value = value[op.type];
                        }
                    }
                }

                // Create new binding to the real component
                this.bindingManager.addBinding(
                    binding.sourceId,
                    realComponent.id,
                    binding.sourceAnchor,
                    binding.targetAnchor
                );
            });
        });


        this.pendingBindings.delete(componentType);
    }
}

export function createLazyAccessor(componentType: string, operations: LazyOperation[] = []): any {
    const lazyComponent = new LazyComponent(componentType, operations);
    LazyBindingRegistry.register(lazyComponent);

    return new Proxy({}, {
        
        get(target, prop) {

            if(prop == 'isLazy'){
                return true;
            }

            if(prop == 'id'){
                return lazyComponent.id;
            }

            if (prop === 'count') {
                lazyComponent.operations.push({ type: 'count', args: [] })
                return () => createLazyAccessor(componentType, [...operations, { type: 'count', args: [] }]);
            }
            if (prop === 'filter') {
                lazyComponent.operations.push({ type: 'count', args: [] })
                return (expr: string) => createLazyAccessor(componentType, [...operations, { type: 'filter', args: [expr] }]);
            }
            if (prop === 'groupby') {
                lazyComponent.operations.push({ type: 'count', args: [] })

                return (...fields: string[]) => createLazyAccessor(componentType, [...operations, { type: 'groupby', args: fields }]);
            }
            if (prop === 'percent') {
                lazyComponent.operations.push({ type: 'count', args: [] })

                return createLazyAccessor(componentType, [...operations, { type: 'percent', args: [] }]);
            }

            lazyComponent.operations.push({ type: prop, args: null })// if null args, then use as a property not a fn
            return createLazyAccessor(componentType, []);
        }
    });
}
