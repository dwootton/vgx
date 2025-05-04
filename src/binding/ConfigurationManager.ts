import { ConfigurationValue } from "../components/base";

/**
 * Manages configuration values for components.
 * Configurations are stored hierarchically by componentId -> portGroup -> portName
 */
export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private configurations = new Map<string, Map<string, Map<string, ConfigurationValue>>>();
    
    private constructor() {}
    
    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }
    
    /**
     * Add or update a configuration value
     */
    addConfiguration(componentId: string, portGroup: string, portName: string, value: ConfigurationValue) {
        if (!this.configurations.has(componentId)) {
            this.configurations.set(componentId, new Map());
        }
        const componentConfigs = this.configurations.get(componentId)!;
        
        if (!componentConfigs.has(portGroup)) {
            componentConfigs.set(portGroup, new Map());
        }
        const groupConfigs = componentConfigs.get(portGroup)!;
        
        groupConfigs.set(portName, value);
    }
    
    /**
     * Get a configuration value
     */
    getConfiguration(componentId: string, portGroup: string, portName: string): ConfigurationValue | undefined {
        return this.configurations.get(componentId)?.get(portGroup)?.get(portName);
    }

    /**
     * Get all configurations for a component
     */
    getComponentConfigurations(componentId: string): Record<string, Record<string, ConfigurationValue>> {
        const result: Record<string, Record<string, ConfigurationValue>> = {};
        const componentConfigs = this.configurations.get(componentId);
        
        if (!componentConfigs) return result;
        
        for (const [groupName, groupConfigs] of componentConfigs) {
            result[groupName] = {};
            for (const [portName, value] of groupConfigs) {
                result[groupName][portName] = value;
            }
        }
        
        return result;
    }

    /**
     * Clear configurations for a component
     */
    clearComponentConfigurations(componentId: string) {
        this.configurations.delete(componentId);
    }
} 