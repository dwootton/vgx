import { CombinedDrag, generateConfigurationAnchors, } from "../Drag";
import { BindingManager } from "../../../binding/BindingManager";
import { Line } from "../../marks/line";
import { extractComponentBindings } from "../../../binding/utils";
import { DataAccessor } from "../../DataAccessor";
import { BaseComponent } from "../../../components/base";
import { CompilationContext } from "../../../binding/binding";
import { transforms } from "vega";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";



export class GridConstructor {
    id: string;
    constructor(config: any) {


        // Get all components that need to be bound
        const allBindings = extractComponentBindings(config);








        const lines = new Line({ ...config }); //bind: [...allBindings,{x: new CombinedDrag(config)}]

        const grid = new Grid({ ...config, bind: [...allBindings,lines] });
        console.log('grid', grid)
        this.id = grid.id;

        // grid.bind(lines);

        // const drag = new CombinedDrag({ bind: [...allBindings,{ span: [new Rect({ "strokeDash": [6, 4],'stroke':'firebrick','strokeWidth':2,'strokeOpacity':0.7,'fillOpacity':0.2,'fill':'firebrick'}),brush ]},] });


        const lineProxy = new Proxy(lines, {
            get(target, prop, receiver) {
                // If accessing 'data' property, redirect to brush.data
                if (prop === 'data') {
                    return grid._data;
                }
                if (prop === 'grid') {
                    return grid;
                }

                // For all other properties, use the original drag object
                return Reflect.get(target, prop, receiver);
            }
        });

        const bindingManager = BindingManager.getInstance();

        bindingManager.removeComponent(lines.id);
        bindingManager.addComponent(lineProxy);

        grid.drag = lineProxy;

        // Return the proxy instead of the original drag object
        return lineProxy;

    }
}


const configurations = [{
    'id': 'base',
    "default": true,
    "schema": {
        "data": {
            "container": "Set",
            "valueType": "Data",
            // "interactive": true
        },
        "x": {
            "container": "Set",
            "valueType": "Numeric",
            // "interactive": true
        // },
        // "y": {
        //     "container": "Set",
        //     "valueType": "Numeric",
        //     // "interactive": true
        // }
        }

    },
    "transforms": [
        {
            "name": "x",
            "channel": "x",
            "value": "BASE_NODE_ID.x"
        },
        {
            "name": "y",
            "channel": "y",
            "value": "BASE_NODE_ID.y"
        }


    ]
},
]

export class Grid extends BaseComponent {
    _data: DataAccessor;
    accessors: DataAccessor[];
    constructor(config: any) {
        super(config, configurations);
        this._data = new DataAccessor(this);
        console.log('grid constructor', this._data)

        this.accessors = [];
        configurations.forEach(config => {
            const schema = config.schema
            for (const key in schema) {
                const schemaValue = schema[key];
                const keyName = config.id + '_' + key
                this.schema[keyName] = schemaValue;

                console.log('GRIDkeyName', keyName, schemaValue)


                this.anchors.set(keyName, this.createAnchorProxy({ [keyName]: schemaValue }, keyName, () => {
                    const generatedAnchor = generateConfigurationAnchors(this.id, config.id, key, schemaValue)
                    return generatedAnchor
                }));
            }
        });

        console.log('grid anchors', this.anchors)




        // // // If config doesn't have data, add our generated dataset
        // // if (!config.data) {
        // //     config.data = dataset;
        // // }
        // const lines = new DraggableLine({data:dataset});

        // const lines2 = new DraggableLine(config);

        // console.log('grid', lines, lines2)

        // return [lines,lines2];
    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        console.log('grid compileComponent', inputContext)
        const compilation = {
            "data": {
                name: "VGXMOD_" + this.id + "_transform_data",
                transform: transforms,
                source: "baseChartData"
            },
            "params": [
                //@ts-ignore
                {
                    "name": this.id + "_transform_text",
                    "value": "count", // the name of the field to read data from
                }
            ]
        };


        // Generate a dataset of objects with {x:#} from 0-100
        const generateDataset = (count: number, min: number, max: number) => {
            const dataset = [];
            const step = (max - min) / (count - 1);

            // Generate a random ID for this dataset
            // const randomId = Math.random().toString(36).substring(2, 15) + 
            //                  Math.random().toString(36).substring(2, 15);

            // // Add the random ID to the dataset metadata
            // const datasetId = `grid_dataset_${randomId}`;

            for (let i = 0; i < count; i++) {
                const x = min + (step * i);

                const randomId = Math.random().toString(36).substring(2, 15) +
                    Math.random().toString(36).substring(2, 15);
                dataset.push({ id: randomId, xValue: x });
            }
            // Add y values to each data point
            dataset.forEach(point => {
                point.yValue = 300 * Math.random();
            });
            console.log('dataset', dataset)

            return dataset;
        };
        console.log('generateDataset', generateDataset(10, 0, 400))

        // Create a dataset with 10 points from 0-100
        const dataset = generateDataset(10, 0, 400);
        // const sequence = {
        //     "start":0,
        //     "stop":400,
        //     "step":40,
        //     "as":"x"
        // }

        // const data = {
        //     "name": this.id + "base_data",
        //     "values": dataset
        // }

        const data = {
            "name": "VGXMOD_" + this.id + "_base_data",
            "values": dataset
        }



        return { params: [], data };
    }
}


// export class DraggableLine extends Line {
//     constructor(config: any) {
//         super(config);

//         const lines = new Line({ ...config, bind: { x: new CombinedDrag(config) } });


//         return lines;

//     }
// }

// const configurations = [{
//     'id': 'position',
//     "default": true,
//     "schema": {
//         "x": {
//             "container": "Set",
//             "valueType": "Numeric",
//             // "interactive": true
//         },
//         "y": {
//             "container": "Set",
//             "valueType": "Numeric",
//             // "interactive": true
//         }
//     },
//     "transforms": [
//         { "name": "x", "channel": "x", "value": "BASE_NODE_ID.x" }, //data set x value will be each x value.
//         { "name": "y", "channel": "y", "value": "BASE_NODE_ID.y" } //data set y value will be each y value.
//     ]
// }];
