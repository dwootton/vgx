import { BaseComponent } from "../components/base";
import { BindingManager } from "./BindingManager";

export type LazyOperation = {
    type: 'count' | 'filter' | 'groupby' | 'percent';
    args: any[];
}
let fakeProxyCounter = 0;

export class LazyComponent {
    id: string;
    componentType: string;
    operations: LazyOperation[];
    isLazy: boolean = true;

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
            console.log('registering lazy component', componentType);
            this.pendingBindings.set(componentType, []);
        }
        this.pendingBindings.get(componentType)!.push(lazyComponent);
    }

    static resolve(componentType: string, realComponent: BaseComponent): void {
        const pending = this.pendingBindings.get(componentType) || [];


        if (pending.length == 0) {
            return;
        }

        // Process each pending lazy c
        // omponent
        pending.forEach(lazyComponent => {
            // Find all bindings to the fake proxy
            const bindings = this.bindingManager.getBindingsForComponent(lazyComponent.id, 'target');



            // Rewrite each binding to point to the real component
            bindings.forEach(binding => {

                //TODO implement a extension type for DataAccessor components to fix type errors
                let realBrush = this.bindingManager.getComponent(realComponent.id);
                let accessor = realBrush;
                console.log('realBrush', realBrush)
                if(realBrush){
                    // realBrush = realBrush.data;
                    realBrush = realBrush
                    this.bindingManager.addComponent(realBrush);
                }

                
                if(accessor){
                    accessor = accessor._data;
                    console.log('realBrushAccessor', accessor)

                    accessor.applyOperations(accessor, lazyComponent.operations);
                    realBrush = accessor.toComponent();
                }

               
                // remove old binding 
                 this.bindingManager.removeBinding(
                    binding.sourceId,
                    binding.targetId,
                    binding.sourceAnchor,
                    binding.targetAnchor
                );
                
                // Create the inverse binding as these are cases where text should be created via the brush. 
                this.bindingManager.addBinding(
                   
                    realBrush.id,
                    binding.sourceId,
                    
                    binding.targetAnchor,
                    binding.sourceAnchor
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
