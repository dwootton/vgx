import { PortType } from './portTypes';

export interface ComponentProcessor<T = any> {
    [eventName: string]: {
        update: (nodeId: string) => string;  // Returns expression string
    };
}

export interface StaticComponentProcessor<T = any> {
    [key: string]: any;  // Static initial data
}

export interface DerivedDataConfig {
    port: string;
    portGroup: string;
    expr: (nodeId: string) => string;
    invert?: DerivedDataConfig[];
}

export interface ComponentConfig<T = any> {
    processor: ComponentProcessor<T> | StaticComponentProcessor<T>;
    derivedData: DerivedDataConfig[];
    initialData?: T;
}

export interface PortReference {
    name: string;
    type: PortType;
    portGroup: string;
    componentId: string;
}

// Re-export existing types if they were here before 

export type CompilationContext = any; 