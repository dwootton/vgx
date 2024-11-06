import { BaseComponent } from "../base";
import { RectAnchorConfig, RectAnchors } from "../../anchors/rect";

type BrushConfig = RectAnchorConfig;

export class Brush extends BaseComponent {
    private rectAnchors: RectAnchors;
  
    constructor(config: BrushConfig) {
      super();
      this.rectAnchors = new RectAnchors(this);
      
      // Initialize base rect anchors
      const anchors = this.rectAnchors.initializeRectAnchors({
        x1: config.x1 || 0,
        y1: config.y1 || 0,
        x2: config.x2 || 100,
        y2: config.y2 || 100
      });
  
      // Add to component anchors
      anchors.forEach((anchor, id) => {
        this.anchors.set(id,this.createAnchorProxy(anchor));
      });
    }
  }

console.log(Brush);