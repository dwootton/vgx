import { BaseComponent } from "../base";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Placeholder } from "../../types/compilation";
import { GeometricAnchorSchema } from "../../types/anchors";
import { Point as PointType } from "../../types/geometry";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";

interface PointConfig {
  x?: number; // Can be a static number or a dynamic expression
  y?: number;
}

export class Point extends BaseComponent {
  private config: PointConfig;

  constructor(config: PointConfig = {}) {
    super();
    console.log('centerAnchor', config);

    this.config = config;
    this.requiredProperties = ['x', 'y'];
    this.initializeAnchors();
  }

  private initializeAnchors() {
    const centerAnchor: GeometricAnchorSchema<PointType> = {
      id: "center",
      type: "geometric",
      geometry: {
        type: "point",
        x: this.config.x ?? 0,
        y: this.config.y ?? 0
      }
    };
    this.anchors.set(centerAnchor.id, this.createAnchorProxy(centerAnchor));
  }

  compileComponent(context: CompilationContext): Partial<UnitSpec<Field>> {
    console.log('point compileComponent', context);

    const spec = {
      name: this.id,
      data: {"values":[{"name": "datum"}]},
      mark: {
        type: "circle",
        x:  50,
        y:  20,
        color: "firebrick",
        size: 100,
        opacity: 1
      }
    } as Partial<UnitSpec<Field>>;

   

    
    return spec;
  }
}