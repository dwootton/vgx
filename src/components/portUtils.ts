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
 * TODO: fill in such that the types are generated from the port configuraitons 
 * 
 */
export type ComponentPropsFromPorts<T extends readonly PortConfiguration[]> = {
    // Default properties (both bindings and configuration values)
    [key: string]: ComponentArgument;
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