// 


//Rect brush is defined as [x1,x2,y1,y2]


// TODO fix issue
import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import {  AnchorType } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";



export const brushBaseContext: Record<AnchorType, any> = {
    x: null,
    y: null,
    color: "'transparent'", // in vega, color needs to be a string in the expression
    stroke: "'firebrick'", 
    data: {"values":[{ }]} // Empty data array to only render one mark
}

type BrushConfig = {
    [K in keyof typeof brushBaseContext]?: typeof brushBaseContext[K]
}

export class IntervalSelect extends BaseComponent {
    public config: BrushConfig;
    static bindableProperties = ['x', 'y'] as const;

    constructor(config: BrushConfig = {}){
        super({...config});
        console.log('IntervalSelect constructor', this, config)
        
        // Create individual coordinate anchors
        this.anchors = generateAnchorsFromContext(config, brushBaseContext, this);
        
        // Create group anchors
        this.createGroupAnchor('x', ['x1', 'x2']);
        this.createGroupAnchor('y', ['y1', 'y2']);

        IntervalSelect.bindableProperties.forEach(prop => {
            if (config[prop] !== undefined) {
                //this.addContextBinding(prop, config[prop]);
            }
        });

        this.config = config;
        this.initializeAnchors();
    }

    private createGroupAnchor(groupName: string, children: string[]) {
        this.anchors.set(groupName, {
            id: { componentId: this.id, anchorId: groupName },
            component: this,
            anchorSchema: {
                id: groupName,
                type: 'group',
                children: children,
                interactive: true // Selection anchors are always interactive
            },
            bind: (target: any) => {
                children.forEach(child => 
                    this.anchors.get(child)?.bind(target)
                );
                return this;
            },
            compile: (nodeId?: string) => ({
                source: 'generated',
                value: children.reduce((acc, child) => ({
                    ...acc,
                    [child]: this.anchors.get(child)?.compile(nodeId)?.value
                }), {})
            })
        });
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const brushName = `${inputContext.nodeId}_brush`;
        
        return {
            params: [{
                name: brushName,
                select: {
                    type: "interval",
                    mark: { fill: "transparent", stroke: "firebrick" }
                }
            }, {
                name: generateComponentSignalName(inputContext.nodeId),
                // @ts-ignore allow as params can have expr
                expr: `{
                    x1: ${brushName}_x[0],
                    x2: ${brushName}_x[1],
                    y1: ${brushName}_y[0],
                    y2: ${brushName}_y[1]
                }`
            }]
        };
    }
}