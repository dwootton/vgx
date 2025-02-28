
import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { InteractorSchema } from "../../types/anchors";

console.log('not broken')

export class Drag extends BaseComponent {
        public schemas: InteractorSchema[];
        constructor(config: any = {}) {
            super(config);

            this.schemas = [{
                schemaId: 'current',
                schemaType: 'Scalar', 
                extractors: [currentExtractor('x'), currentExtractor('y')]
            }];

            this.initializeAnchors();
        }

        compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
            const nodeId = inputContext.nodeId || this.id;
            const signal = {
                name: this.id,
                value: dragBaseContext,
                on: [{
                    events: {
                        type: 'pointermove',
                        between: [
                            { type: "pointerdown", "markname": inputContext.markName},
                            { type: "pointerup" }
                        ]
                    },
                    update: `merge(${nodeId}, {'x': x(), 'y': y()})`
                }]
            };

            return {
                params: [signal]
            };
        }
    }
