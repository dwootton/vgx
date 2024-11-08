import { BaseComponent } from "../base";
import { GeometricAnchor } from "types/anchors";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Point } from "types/geometry";

// Define the configuration type for the Point component
interface PointConfig {
  x: number;
  y: number;
}

export class PointComponent extends BaseComponent {
  private config: PointConfig;

  constructor(config: PointConfig) {
    super();
    this.config = config;
    this.initializeAnchors();
  }

  private initializeAnchors() {
    // Create a center anchor for the point
    const centerAnchor: GeometricAnchor<Point> = {
      id: "center",
      type: "geometric",
      geometry: {
        type: "point",
        x: this.config.x,
        y: this.config.y
      }
    };

    // Add the anchor to the component
    this.anchors.set(centerAnchor.id, this.createAnchorProxy(centerAnchor));
  }

  compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {
    // Check if there is a bound anchor; if not, return empty
    if (!parentInfo?.boundAnchor) {
      return {};
    }

    const { boundAnchor } = parentInfo;
    const signalName = `${this.id.replace(/\./g, '_')}_pointDatum`;


    console.log('compiled context', context)
    // Compile the point component to a Vega-Lite mark with params
    const compiledParams = [
      {
        "name": signalName,
        "value": { "x": this.config.x, "y": this.config.y },
        "on": [
          {
            "events": {
              "source": "window",
              "type": "pointermove",
              "between": [
                { "type": "pointerdown", "markname": "layer_1_marks" },
                { "type": "pointerup", "source": "window" }
              ]
            },
            "update": "{'x':clamp(x(),range('x')[0],range('x')[1]),'y':clamp(y(),range('y')[1],range('y')[0])}"
          }
        ]
      }
    ];

    const circleMark = {
      "type": "circle",
      "x": { "expr": `${signalName}.x` },
      "y": { "expr": `${signalName}.y` },
      "color": "firebrick",
      "size": 300,
      "opacity": 1

    };

    return {
      spec: {
        data: { "values": [{ "name": "pointData" }] },
        params: compiledParams,
        //@ts-ignore
        mark: circleMark
      }
    };
  }
}
