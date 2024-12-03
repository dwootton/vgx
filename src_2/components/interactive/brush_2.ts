import { BaseComponent } from "../base";
import { RectAnchorConfig, RectAnchors } from "../../anchors/rect";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Line, Area, Point } from "types/geometry";
import { GeometricAnchorSchema } from "types/anchors";

type BrushConfig = RectAnchorConfig;
// Types for information passed down from parent during compilation

export class Brush2 extends BaseComponent {
  private rectAnchors: RectAnchors;
  private config: BrushConfig;
  constructor(config: BrushConfig) {
    super();
    this.config = config;
    this.rectAnchors = new RectAnchors(this);
    this.initializeAnchors();
  }

  private initializeAnchors() {

    // Initialize base rect anchors
    const anchors = this.rectAnchors.initializeRectAnchors({
      x1: this.config.x1 || 0,
      y1: this.config.y1 || 0,
      x2: this.config.x2 || 100,
      y2: this.config.y2 || 100
    });

    // Add to component anchors
    anchors.forEach((anchor, id) => {
      this.anchors.set(id, this.createAnchorProxy(anchor));
    });
  }

  compileComponent(context: CompilationContext, parentInfo?: ParentInfo): Partial<CompilationResult> {
    // if compile called on brush, bubble it up to root component

    // TODO need to handle brush compilation through the idea of what its bound to
    // for example if bound to brush.x, then we need to change how selectionSpec is compiled via the x lines. 
    // there needs to be underlying logic about how to compile based upon these components (might it change between params?)

    console.log('brush compileComponent', parentInfo);
    if (!parentInfo?.childAnchor) {
      return {}; // No parent info or bound anchor
    }

    // Base selection parameter
    const selectionSpec: any = {
      name: `${this.id}_selection`,
      //  "mark":{
        // "fillOpacity":0,
        // "strokeOpacity":0
      // }
      select: { type: "interval" ,}
    };
    console.log('brush compileComponent', selectionSpec);


    const { childAnchor } = parentInfo;
    const childAnchorSchema = childAnchor.anchorRef


    // Determine selection behavior based on bound anchor
    switch (childAnchor.anchorRef.type) {
      case 'group':
        // If bound to a group anchor (like chart.x or chart.xy)
        // now apply to all children components 


        console.log('NOT IMPLEMENTED YET: group');
        break;
      case 'encoding':
        console.log('brush compileComponent in ecncoding', selectionSpec);
        // If bound to an encoding anchor (like chart.x or chart.xy)
        if (childAnchorSchema.id === 'x') {
          selectionSpec.select.encodings = ['x'];
        } else if (childAnchorSchema.id === 'y') {
          selectionSpec.select.encodings = ['y'];
        } else if (childAnchorSchema.id === 'xy') {
          selectionSpec.select.encodings = ['x', 'y'];
        }
        break;

      case 'geometric':
        // Handle geometric anchors (like points, lines, areas)
        const geometry = (childAnchorSchema as GeometricAnchorSchema<any>).geometry;
          switch (geometry.type) {
            case 'line':
              // Determine if line is horizontal or vertical
              const { y1, y2, x1, x2 } = geometry;
              if (y1 === y2) {
                selectionSpec.select.encodings = ['x'];
              } else if (x1 === x2) {
                selectionSpec.select.encodings = ['y'];
              }
              break;
            case 'area':
              selectionSpec.select.encodings = ['x', 'y'];
              break;
            case 'point':
              // Point doesn't make sense for interval selection
              return {};
          }
        
        break;
    }
    console.log('brush compileComponent', selectionSpec);

    return {
      spec: {"params":[selectionSpec]},
      componentId: this.id
    };
  }

}