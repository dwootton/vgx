import { BaseComponent } from "../base";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Placeholder } from "../../types/compilation";
import { GeometricAnchorSchema } from "../../types/anchors";
import { Point as PointType } from "../../types/geometry";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { PointAnchors } from "../../anchors/point";

interface PointConfig {
  x?: number; // Can be a static number or a dynamic expression
  y?: number;
}

export class Point extends BaseComponent {
  private config: PointConfig;
  private pointAnchors: PointAnchors;

  constructor(config: PointConfig = {}) {
    super();
    console.log('centerAnchor', config);
    this.config = config;
    this.requiredProperties = ['x', 'y'];
    this.pointAnchors = new PointAnchors(this);

    this.initializeAnchors();
  }

  private initializeAnchors() {
    // Initialize base rect anchors
    const anchors = this.pointAnchors.initializePointAnchors({
      x: this.config.x || 0,
      y: this.config.y || 0,
    });

    // Add to component anchors
    anchors.forEach((anchor, id) => {
      this.anchors.set(id, this.createAnchorProxy(anchor));
    });
  }

  compileComponent(context: CompilationContext): Partial<UnitSpec<Field>> {
    console.log('point compileComponent', this.pointAnchors,this.anchors.get('x'),);

    const spec = {
      name: this.id,
      data: {"values":[{"name": "datum"}]},
      mark: {
        type: "circle",
        color: "firebrick",
        x: this.anchors.get('center').value.x,
        y: this.anchors.get('center').value.y,
        size: 100,
        opacity: 1
      }
    } as Partial<UnitSpec<Field>>;

   

    
    return spec;
  }
}