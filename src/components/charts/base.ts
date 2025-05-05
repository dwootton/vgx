import { BaseComponent, ComponentConfig, ComponentProps, ConfigurationValue } from "../base";
import { ConfigurationManager } from "../../binding/ConfigurationManager";
import { CompilationContext } from "types/components";
import { StandardType } from 'vega-lite/build/src/type';
import { UnitSpec } from 'vega-lite/build/src/spec/unit';
import { Field, FieldDef, FieldDefBase } from 'vega-lite/build/src/channeldef';
import { AllPortTypes } from '../../types/portTypes';
import { createBaseState } from '../portExpressions';
import { PortConfiguration } from '../portExpressions';
import type { ExprRef, SignalRef } from 'vega';
import { Gradient } from 'vega-typings';

type FieldName = string;
type FieldValue = string | ExprRef | SignalRef | Gradient | null;

// Base state for all charts
export const initChartState = {
    x: 'x',
    y: 'y',
    color: 'color',
    data: [],
    // Dimensions
    width: 600,
    height: 400,
    // Scale ranges
    x1: 0,
    x2: 600,
    y1: 0,
    y2: 400,
};

const chartStateRef = createBaseState(initChartState);

// Port Groups for charts
export const chartPortGroup = {
    DEFAULT: 'default',    // Basic properties
    SCALE: 'scale',       // Scale-related properties
    DATA: 'data'          // Data-related properties
};

// Base port configurations for all charts
export const baseChartPortConfigurations = [
    {port: AllPortTypes.DATA, portGroup: chartPortGroup.DEFAULT, read: chartStateRef.data},
    // Default mode - basic properties
    {port: AllPortTypes.X, portGroup: chartPortGroup.DEFAULT, read: chartStateRef.x},
    {port: AllPortTypes.Y, portGroup: chartPortGroup.DEFAULT, read: chartStateRef.y},
    {port: AllPortTypes.WIDTH, portGroup: chartPortGroup.DEFAULT, read: chartStateRef.width},
    {port: AllPortTypes.HEIGHT, portGroup: chartPortGroup.DEFAULT, read: chartStateRef.height},
    // Scale ranges
    {port: AllPortTypes.X1, portGroup: chartPortGroup.SCALE, read: chartStateRef.x1},
    {port: AllPortTypes.X2, portGroup: chartPortGroup.SCALE, read: chartStateRef.x2},
    {port: AllPortTypes.Y1, portGroup: chartPortGroup.SCALE, read: chartStateRef.y1},
    {port: AllPortTypes.Y2, portGroup: chartPortGroup.SCALE, read: chartStateRef.y2},
];

export type BaseChartPortConfigurations = typeof baseChartPortConfigurations;
export type BaseChartProps = ComponentProps<BaseChartPortConfigurations>;

// Base encoding definition for field-based encodings
export type FieldEncodingDef = {
    field: FieldName;
    type: StandardType;
};

// Base encoding definition for constant value-based encodings
type ValueEncodingDef = {
    value: FieldValue;
};

// General encoding definition that combines both options
type EncodingDef = FieldEncodingDef | ValueEncodingDef;

// Specific encoding for positional channels (only allows field-based encodings)
export type PositionEncodingDef = FieldEncodingDef;


type EncodingDefs = Record<string, EncodingDef | PositionEncodingDef>;
type SplitConfig = {
    encodingBinds: Record<string, BaseComponent>;
    encodingDefs: EncodingDefs;
}

// Chart-specific properties
export interface ChartProps {
    data?: any[];
    width?: number;
    height?: number;
    x?: string;
    y?: string;
    color?: string;
    size?: number;
}

// Define our specific spec type that we know will have encoding
export type ChartSpec = Partial<UnitSpec<Field>>;

/**
 * Base class for all chart components
 * Handles common chart configuration processing
 */
export abstract class BaseChart extends BaseComponent {
    protected configManager: ConfigurationManager;

    constructor(props: ComponentConfig<PortConfiguration[]>) {
        super(props);
        this.configManager = ConfigurationManager.getInstance();
    }

    /**
     * Process standard chart properties and store them in the configuration manager
     */
    protected processChartInputs(props: ChartProps) {
        // Process data
        if (props.data) {
            this.configManager.addConfiguration(this.id, 'data', 'values', props.data);
        }

        // Process dimensions
        if (props.width) {
            this.configManager.addConfiguration(this.id, 'dimensions', 'width', props.width);
        }
        if (props.height) {
            this.configManager.addConfiguration(this.id, 'dimensions', 'height', props.height);
        }

        // Process fields
        if (props.x) {
            this.configManager.addConfiguration(this.id, 'fields', 'x', props.x);
        }
        if (props.y) {
            this.configManager.addConfiguration(this.id, 'fields', 'y', props.y);
        }

        // Process aesthetics
        if (props.color) {
            this.configManager.addConfiguration(this.id, 'aesthetics', 'color', props.color);
        }
        if (props.size) {
            this.configManager.addConfiguration(this.id, 'aesthetics', 'size', props.size);
        }
    }

    /**
     * Get all configurations for this chart
     */
    protected getChartConfigurations(): Record<string, Record<string, any>> {
        return this.configManager.getComponentConfigurations(this.id);
    }
}