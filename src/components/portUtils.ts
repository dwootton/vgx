import { BaseComponent, ComponentArgument, ComponentArgumentId, ComponentProp, ComponentProps, ConfigurationEdge } from "./base";
import { PortRelationship, EnhancedStateRef, PortValue, PortConfiguration } from "./portExpressions";

  
//   // Then for components with a default group, we could flatten those to the top level
//   export type ComponentPropsFromPorts<T extends readonly PortConfiguration[]> = {
//     [P in Extract<T[number], { portGroup: 'default' }>['port']]?: ComponentArgument
// } & {
//     [G in Exclude<T[number]['portGroup'], 'default'>]?: {
//         [P in Extract<T[number], { portGroup: G }>['port']]?: ComponentArgument
//     }
// };

/**
 * Creates a type for component props based on port configurations.
 * 
 * The resulting type will:
 * 1. Allow direct properties for ports in the default port group
 * 2. Nest properties for ports in non-default port groups
 * 3. Allow a special 'bind' property for binding to components
 * 
 * @example
 * // For port configurations:
 * // [
 * //   { port: 'x1', portGroup: 'default' },
 * //   { port: 'y1', portGroup: 'default' },
 * //   { port: 'x1', portGroup: 'span' },
 * //   { port: 'x2', portGroup: 'span' }
 * // ]
 * 
 * // The resulting props type allows:
 * {
 *   x1: 100,                    // Configuration for default.x1
 *   y1: 200,                    // Configuration for default.y1
 *   span: {                     // Nested properties for span port group
 *     x1: 0,                    // Configuration for span.x1 
 *     x2: 500                   // Configuration for span.x2
 *   },
 *   bind: Component             // Binding to default port group
 * }
 */
export type ComponentPropsFromPorts<T extends readonly PortConfiguration[]> = {
    // Default port group properties are at the top level
    [P in Extract<T[number], { portGroup: 'default' }>['port']]?: ComponentArgument;
} & {
    // Non-default port groups are nested objects
    [G in Exclude<T[number]['portGroup'], 'default'>]?: {
        [P in Extract<T[number], { portGroup: G }>['port']]?: ComponentArgument;
    } | BaseComponent | BaseComponent[];  // Allow direct component binding to port group
} & {
    // Special 'bind' property for binding to default port group
    bind?: BaseComponent | BaseComponent[];
};
    
export const midpointRelationship = (
    midRef: string,
    startRef: EnhancedStateRef,
    endRef: EnhancedStateRef
  ): [PortRelationship, PortRelationship, PortRelationship] => ([
    {
      ref: midRef,
      update: () => startRef.add(endRef.subtract(startRef).divide(2)),
    },
    {
      ref: startRef,
      update: (mid) => mid.subtract(endRef.subtract(startRef).divide(2)),
    },
    {
      ref: endRef,
      update: (mid) => mid.add(endRef.subtract(startRef).divide(2)),
    },
  ]);


 export const sizeToRadius = (size:EnhancedStateRef):PortRelationship => {
    return {
        ref: size,
        update: (size:PortValue) => size.divide(2)
    }
 }


export const markNameValue = (componentId:string)=>{
    return {
        target:'markName',
        value: componentId + "_marks"
    }
}


const findBindings = (value: any, path: string = ''): { value: BaseComponent, key: string }[] => {
    if (!value) return [];

    // Handle arrays, but skip if path is 'data'
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => findBindings(item, `${path}[${index}]`));
    }

    // Check if value is an object with lazy properties
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const lazyBindings = [];
        for (const prop in value) {
            if (value[prop] && value[prop].isLazy) {
                lazyBindings.push({ value: value[prop], key: prop });
            }
        }
        if (lazyBindings.length > 0) {
            return lazyBindings;
        }
    }

    // Only match if value is a Component or AnchorProxy
    if (value instanceof BaseComponent) {
        return [{ value, key: path }];
    }

    // // Check for AnchorProxy by looking for bind method and anchorSchema property
    // if (value instanceof AnchorProxy) {
    //     return [{ value, key: path }];
    // }

    // If not a direct match but is an object, check its properties
    if (typeof value === 'object' && path !== 'data') {
        return Object.entries(value).flatMap(([key, v]) =>
            findBindings(v, path ? `${path}.${key}` : key)
        );
    }

    return [];
};
// Calculates the initial edges for configuration values 
export function extractConfigEdges<T extends readonly PortConfiguration[]>(props: ComponentPropsFromPorts<T>, ports: T): ConfigurationEdge[] {
    const initialEdges: ConfigurationEdge[] = [];

    // Only extract configurations for ports
    for (const port of ports) {
        const portName = port.port;
        const portGroup = port.portGroup;
        const key = portGroup === 'default' ? portName : `${portGroup}.${portName}`;
        
        if (key in props) {
            initialEdges.push({
                portName,
                portGroup,
                value: props[key as keyof typeof props]
            });
        }
    }

    return initialEdges;
}

export interface ExtractedEdges {
    configEdges: ConfigurationEdge[];
    bindings: { value: BaseComponent, key: string }[];
}

export function extractEdgesAndBindings<T extends readonly PortConfiguration[]>(props: ComponentPropsFromPorts<T>, ports: T): ExtractedEdges {
    const configEdges: ConfigurationEdge[] = [];
    const bindings: { value: BaseComponent, key: string }[] = [];

    // Process each port configuration
    for (const port of ports) {
        const portName = port.port;
        const portGroup = port.portGroup;
        const key = portGroup === 'default' ? portName : `${portGroup}.${portName}`;
        const value = props[key as keyof ComponentPropsFromPorts<T>];
        
        if (value !== undefined) {
            if (value instanceof BaseComponent) {
                bindings.push({ value, key });
            } else if (Array.isArray(value) && value.every(item => item instanceof BaseComponent)) {
                // For arrays of BaseComponents, add each one individually
                value.forEach(component => {
                    bindings.push({ value: component, key });
                });
            } else if (typeof value === 'object' && value !== null) {
                // Handle value
                configEdges.push({ portName, portGroup, value });  
            }
        }
    }

    return { configEdges, bindings };
}