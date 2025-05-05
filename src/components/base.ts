import { BindingManager, PortReference } from '../binding/BindingManager';
import { PortType, MiscPortType } from '../types/portTypes';
import { PortGroup } from '../types/portGroup';
import { CompilationContext } from '../types/components';
import { getGenericPortTypeFromId } from '../binding/compatabilityUtils';
import { PortConfiguration } from './portExpressions';
import { EventType } from 'vega-typings';
import { extractConfigEdges, extractEdgesAndBindings, ComponentPropsFromPorts } from './portUtils';

type StateShape = Record<string, any>;
// Union type for all possible drivers
type StateDriver<T extends StateShape> =
    | StaticStateDriver<T>
    | EventsStateDriver<T>
    | ChartStateDriver<T>
    | ExpressionStateDriver<T>;

// For static values
export interface StaticStateDriver<T extends StateShape> {
    type: 'static';
    initialState: T;
}

export interface ChartStateDriver<T extends StateShape> {
    type: 'chart';
    initialState: T;
}

// For expression-based updates (e.g. scale or signal references)
export interface ExpressionStateDriver<T extends StateShape> {
    type: 'expression';
    initialState: T;
    expressions: {
        [key in keyof T]: string | ((nodeId: string) => string);
    }
}

export interface EventsStateDriver<T extends StateShape> {
    type: 'events';
    initialState: T;
    events: {
        [key in EventType]: (nodeId: string) => string;
    }
}

export interface ConfigurationEdge {
    portName: string;
    portGroup: string;
    value: any;
}

export type ConfigurationValue = string | number | boolean | null | any[];
export type ComponentProp = BaseComponent | ConfigurationValue;
export type ComponentArgument = ComponentProp | ComponentProp[];
export type ComponentArgumentId = string;
export type ComponentProps<T extends readonly PortConfiguration[]> = ComponentPropsFromPorts<T>;
export interface ComponentConfig<T extends readonly PortConfiguration[]> {
    componentProps: ComponentProps<T>;
    portConfigurations: T;
    driver: StateDriver<StateShape>;
}

function scopePortConfiguration(
    portConfig: PortConfiguration,
    componentId: string
): PortConfiguration {
    return {
        ...portConfig,
        read: scopeExpression(portConfig.read, componentId),
        write: portConfig.write?.map(rel => ({
            ref: rel.ref,
            // Need to scope any EnhancedStateRefs used in the update expression
            update: (portValue: any) => scopeExpression(rel.update(portValue), componentId)
        }))
    };
}

function scopeExpression(expr: any, componentId: string): any {
    // Base case: if it's an EnhancedStateRef, set its component ID
    if (expr?.setComponentId) {
        expr.setComponentId(componentId);
        return expr;
    }

    // If it's an operation result (like add, subtract, etc.)
    if (expr?.operands) {
        expr.operands.forEach((op: any) => scopeExpression(op, componentId));
        return expr;
    }

    return expr;
}


/**
 * Interface representing a port group/configuration for a component
 */
export interface ComponentPortGroup {
    id: string;
    name: string;
    ports: Map<string, PortType>;
}

const DEFAULT_PORT_GROUP = 'default';

//TODO change to uuid once we're not debugging...
let nextId = 0;
export function generateId(): string {
    return `node_${nextId++}`;
}

/**
 * Abstract base class for all components in the system
 */
export abstract class BaseComponent {
    protected portGroups: Map<string, PortGroup>;
    protected componentConfig!: ComponentConfig<PortConfiguration[]>;
    protected id: string;
    private bindingManager: BindingManager;
    protected portConfigurations: PortConfiguration[];
    protected stateDriver: StateDriver<StateShape>;

    constructor(props: ComponentConfig<PortConfiguration[]>) {
        this.portGroups = new Map();
        this.id = generateId();
        this.bindingManager = BindingManager.getInstance();
        this.stateDriver = this.parameterizeDriver(props.driver);
        this.portConfigurations = [...props.portConfigurations];
        this.registerPorts(this.portConfigurations);
        this.generateConfigurationEdges(props.componentProps);
    }

    // Some driver values are functions that require the component ID to be used to generate a reference.
    private parameterizeDriver(driver: StateDriver<StateShape>): StateDriver<StateShape> {
        const initialState = driver.initialState;

        // Create a new state object with parameterized values
        const parameterizedState = { ...initialState };

        // For each key in the initial state
        for (const key in initialState) {
            const value = initialState[key];
            // Check if the value is a function
            if (typeof value === 'function') {
                // Call the function with the component ID
                parameterizedState[key] = value(this.id);
            }
        }

        return {
            ...driver,
            initialState: parameterizedState
        };
    }


    private registerPorts(portConfigurations: PortConfiguration[]): void {
        //groupby portConfigurations by portGroup,
        const portGroupMap = new Map<string, PortConfiguration[]>();

        const scopedPortConfigurations = portConfigurations.map(pc => scopePortConfiguration(pc, this.id));

        scopedPortConfigurations.forEach(pc => {
            const portGroup = pc.portGroup;
            if (!portGroupMap.has(portGroup)) {
                portGroupMap.set(portGroup, []);
            }
            portGroupMap.get(portGroup)?.push(pc);
        });

        // then we're going to register each portGroup
        portGroupMap.forEach((portConfigurations, portGroup) => {
            const portGroupObj: PortGroup = {
                id: portGroup,
                name: portGroup,
                ports: new Map(portConfigurations.map(pc => [pc.port, pc]))
            };

            this.registerPortGroup(portGroupObj);
        });
    }

    public getId(): string {
        return this.id;
    }

    // Abstract methods that derived classes must implement
    abstract compile(compilationContext: CompilationContext): any;

    protected generateConfigurationEdges(props: ComponentPropsFromPorts<PortConfiguration[]>) {
        function extractEdgeAndBindingsFixed(props: ComponentPropsFromPorts<PortConfiguration[]>, portConfigurations: PortConfiguration[]): {bindings: { value: BaseComponent | BaseComponent[], key: string }[], configEdges: ConfigurationEdge[]} {
            const bindings: { value: BaseComponent | BaseComponent[], key: string }[] = [];
            const configEdges: ConfigurationEdge[] = [];

            

            function handleProp(prop: any, propPath: string, propType: 'component' | 'port' | 'portGroup' | 'configurationValue') {
                if (propType === 'component') {
                    bindings.push({ value: prop, key: propPath });
                } else if (propType === 'configurationValue') {
                    if(propPath.includes('.')) {
                        const portGroup = propPath.split('.')[0];
                        const portName = propPath.split('.')[1];
                        configEdges.push({ portName: portName, portGroup: portGroup, value: prop });
                    } else {
                        configEdges.push({ portName: propPath, portGroup: DEFAULT_PORT_GROUP, value: prop });
                    }
                }
            }
            
            for (const prop in props) {
                const value = props[prop as keyof typeof props];
                if (Array.isArray(value)) {
                    // Handle each array item
                    value.forEach(item => {
                        const itemType = determinePropType(item);
                        handleProp(item, prop, itemType);
                    });
                } else {
                    const valueType = determinePropType(value);
                    handleProp(value, prop, valueType);
                }
            }
           
            
            return {bindings, configEdges};
        }

        const {bindings, configEdges} = extractEdgeAndBindingsFixed(props, this.portConfigurations);
        // Handle bindings
        if (bindings.length > 0) {
            this.addBindings(bindings);
        }

        if(configEdges.length > 0) {
            this.addConfigurationEdges(configEdges);
        }
    }

    protected addBindings(bindings: { value: BaseComponent | BaseComponent[], key: string }[]) {
        if (bindings.length === 0) return;

        bindings.forEach(({ value, key }) => {
            let portGroup = extractBindingPortGroup(key);

            if (value instanceof BaseComponent) {
                // Direct component binding
                this.addPortGroupBinding(portGroup, value);
            } else if (Array.isArray(value)) {
                // Array of components
                value.forEach(component => this.addPortGroupBinding(portGroup, component));
            } else {
                console.error(`Unsupported binding type: ${value} for portGroup: ${portGroup}`);
            }
        })
    }
    
    protected addConfigurationEdges(configEdges: ConfigurationEdge[]) {
        if (configEdges.length === 0) return;

        configEdges.forEach(({ portName, portGroup, value }) => {
            this.addConfigurationBinding(portGroup, value);
        })
    }

    protected addDefaultBinding(target: BaseComponent) {
        this.bindingManager.addBinding(
            this.id,
            target.getId(),
            'default',
            'default',
            MiscPortType.ALL,
            MiscPortType.ALL
        );
    }

    public bindGroup(group: string, target: BaseComponent) {
        this.addPortGroupBinding(group, target);
    }

    protected registerPortGroup(portGroup: PortGroup): void {
        this.portGroups.set(portGroup.id, portGroup);
    }

    public getPortGroup(groupName: string): PortGroup | undefined {
        return this.portGroups.get(groupName);
    }

    public getPortGroups(): Map<string, PortGroup> {
        return this.portGroups;
    }

    public getPortReferencesForGroup(portGroup: string): PortReference[] {
        const group = this.portGroups.get(portGroup);
        if (!group) return [];

        // Get built-in ports from the port group
        return Array.from(group.ports.entries()).map(([name, portConfiguration]) => ({
            componentId: this.id,
            portType: getGenericPortTypeFromId(portConfiguration.port),
            portGroup: name,
            isInternal: false
        }));
    }

    public bind(target: BaseComponent | Record<string, any>): void {
        if (target instanceof BaseComponent) {
            this.addPortGroupBinding(DEFAULT_PORT_GROUP, target);
            return;
        }

        // Handle object bindings
        Object.entries(target).forEach(([key, value]) => {
            let portGroup = extractBindingPortGroup(key);

            if (typeof value === 'object' && value.bind) {
                this.addPortGroupBinding(portGroup, value.bind);
            } else if (Array.isArray(value)) {
                value.forEach(component => this.addPortGroupBinding(portGroup, component));
            } else {
                console.error(`Unsupported binding type: ${value} for port group: ${portGroup}`);
            }
        });
    }

    protected addConfigurationBinding(portGroup: string, target: BaseComponent) {
        if (!target) {
            console.error('Target component is undefined');
            return;
        }

        // Don't create configuration bindings for BaseComponents
        // This prevents duplicate bindings when a component is directly provided in a props field
        // instead of nested in an object with 'bind'
        console.warn('Skipping configuration binding for BaseComponent - use explicit bind property instead');
    }

    protected addPortGroupBinding(portGroup: string, target: BaseComponent) {
        if (!target) {
            console.error('Target component is undefined');
            return;
        }

        const sourceId = this.id;
        const targetId = target.getId();
        const sourcePortGroup = portGroup;
        const targetPortGroup = DEFAULT_PORT_GROUP; // default as the target is a component
        const sourcePortType = MiscPortType.ALL;
        const targetPortType = MiscPortType.ALL;
        const sourceIsInternal = false;
        const targetIsInternal = false;
        
        // Check if this binding already exists before adding it
        const existingBindings = this.bindingManager.getBindingsForComponent(sourceId);
        const hasDuplicate = existingBindings.some(binding => 
            binding.target.componentId === targetId &&
            binding.source.portGroup === sourcePortGroup &&
            binding.target.portGroup === targetPortGroup
        );
        
        if (!hasDuplicate) {
            // Add to binding manager
            this.bindingManager.addBinding(
                sourceId, 
                targetId, 
                sourcePortGroup, 
                targetPortGroup, 
                sourcePortType, 
                targetPortType, 
                sourceIsInternal, 
                targetIsInternal
            );
        }
    }
}


function isAllBind(key: string) {
    return key === 'bind' || (/^bind\[\d+\]$/.test(key) && !key.includes('.'))
}

function extractBindingPortGroup(key: string) {
    let bindingProperty = key.includes('.') ? key.split('.')[0] : (isAllBind(key) ? DEFAULT_PORT_GROUP : key);

    // Check if bindingProperty has array index patterns like "bind[0]" or "span[0]"
    const match = bindingProperty.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
        // Extract the base name (like "bind" or "span") and ignore the index
        const baseName = match[1];
        let newBindingProperty = baseName;

        // For "bind" specifically, we want to use "_all"
        if (baseName === MiscPortType.ALL) {
            newBindingProperty = DEFAULT_PORT_GROUP;
        }

        bindingProperty = newBindingProperty;
    }

    return bindingProperty;
}

// Then components just need to define their shape
export interface ChartPropsShape {
    data?: any[];
    width?: number;
    height?: number;
    xField?: string;
    yField?: string;
    color?: string;
    size?: number;
}


function determinePropType(prop: any): 'component' | 'port' | 'portGroup' | 'configurationValue' {
    if (prop instanceof BaseComponent) {
        return 'component';
    } 

    return 'configurationValue';
}
