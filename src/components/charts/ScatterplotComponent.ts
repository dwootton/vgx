import { BaseComponent, ComponentConfig, ComponentProps } from '../base';
import { BaseChart, BaseChartPortConfigurations, baseChartPortConfigurations, chartPortGroup, initChartState } from './base';
import { CompilationContext } from '../../types/components';
import { createBaseState } from '../portExpressions';
import { PortConfiguration } from '../portExpressions';
import { AllPortTypes, ChannelType } from '../../types/portTypes';
import { StaticStateDriver } from '../base';
import { ComponentPropsFromPorts } from 'components/portUtils';

// Scatterplot-specific state
const initScatterplotState = {
    ...initChartState,
    // Visual properties
    fill: 'steelblue',
    stroke: 'none',
    size: 50
};

const scatterStateRef = createBaseState(initScatterplotState);

// Additional port configurations specific to scatterplot
const scatterplotSpecificPorts = [
    {port: ChannelType.COLOR, portGroup: chartPortGroup.DEFAULT, read: scatterStateRef.fill},
    {port: ChannelType.OPACITY, portGroup: chartPortGroup.DEFAULT, read: scatterStateRef.stroke},
    {port: ChannelType.SIZE, portGroup: chartPortGroup.DEFAULT, read: scatterStateRef.size},
] as const;

const scatterplotPortConfigurations = [...baseChartPortConfigurations, ...scatterplotSpecificPorts] as const;

export type ScatterplotPortConfigurations = typeof scatterplotPortConfigurations;
export type ScatterplotProps = ComponentPropsFromPorts<ScatterplotPortConfigurations>;

const scatterDriver: StaticStateDriver<typeof initScatterplotState> = {
    type: 'static',
    initialState: initScatterplotState
};

export class ScatterplotComponent extends BaseChart {
    constructor(props: ScatterplotProps) {
        super({
            componentProps: props,
            portConfigurations: [...scatterplotPortConfigurations],
            driver: scatterDriver
        });
    }

    compile(compilationContext: CompilationContext): any {
        const configs = this.getChartConfigurations();
        const { width, height } = configs.dimensions || {};
        const { x: xField, y: yField } = configs.fields || {};
        const { values: data } = configs.data || {};
        const { fill, stroke, size } = configs.aesthetics || {};
        const { x1, x2, y1, y2 } = compilationContext.state;

        return {
            name: this.id,
            mark: {
                type: 'circle',
                size: size || initScatterplotState.size,
                fill: fill || initScatterplotState.fill,
                stroke: stroke || initScatterplotState.stroke
            },
            data: { values: data || [] },
            encoding: {
                x: { field: xField, type: 'quantitative', scale: { range: [x1, x2] } },
                y: { field: yField, type: 'quantitative', scale: { range: [y2, y1] } }
            },
            width: width || initChartState.width,
            height: height || initChartState.height
        };
    }
} 