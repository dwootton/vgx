import { BaseComponent } from "../base";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Placeholder } from "../../types/compilation";
import { GeometricAnchorSchema } from "../../types/anchors";
import { Point as PointType } from "../../types/geometry";

interface PointConfig {
  x?: number; // Can be a static number or a dynamic expression
  y?: number;
}

export class Point extends BaseComponent {
  private config: PointConfig;

  constructor(config: PointConfig) {
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

  compileComponent(context: CompilationContext, parentInfo?: ParentInfo): Partial<CompilationResult> {
    console.log('point compileComponent', parentInfo);

    const placeholders: Placeholder[] = [];

    // Retrieve initial positions from parent info if available
    const anchorRef = parentInfo?.parentAnchor?.anchorRef;

    //this will incorrectly set x and y to be undefined if the parebt doesn't have a .x property.
    // for example, with a plot object (rect) it doesn't have a .x property (x1,x2...), so it will be undefined. 
    // we may need to have some logic that will "get point from rect" etc that will take the average of x1,x2 etc. This should exist on each anchor?
    // we should also have this first priopritze any config set. 

    // getting initial value to set the mark properties (even compiler should actually be changing marks posiiton to be signal based)
    const centerAnchor = this.anchors.get('center')?.anchorRef as GeometricAnchorSchema<PointType>;
    const intialX = centerAnchor.geometry.x;
    const intialY = centerAnchor.geometry.y;
    
    // const parentInitialX = anchorRef?.type === 'geometric' ? (anchorRef as GeometricAnchor<PointType>).geometry?.x : `placeholder_${this.id}_x`;
    // const parentInitialY = anchorRef?.type === 'geometric' ? (anchorRef as GeometricAnchor<PointType>).geometry?.y : `placeholder_${this.id}_y`;

    // const xExpr = `clamp(${this.config.x ?? parentInitialX}, scale('x').range[0], scale('x').range[1])`;
    // y is inverted because svg's y-axis is inverted
    // const yExpr = `clamp(${this.config.x ?? parentInitialY}, scale('y').range[1], scale('y').range[0])`;

    // if (xExpr.includes("placeholder")) {
    //   placeholders.push({ property: 'x', componentId: this.id });
    // }
    // if (yExpr.includes("placeholder")) {
    //   placeholders.push({ property: 'y', componentId: this.id });
    // }

    const result: Partial<CompilationResult> = {
      spec: {
        data: {"values":[{"name": "datum"}]},
        mark: {
          "type": "point",
          x:  intialX ,
          y:  intialY ,
          color: "firebrick",
          size: 100,
          opacity: 1
        }
      },
      placeholders
    };
    console.log('point result', result);
    return result;
  }
}