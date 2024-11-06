// import { BaseComponent } from "../base";
// import { Point } from "../../types/geometry";
// import { generateId } from "utils/id";

// // src/components/drag-point.ts
// export class DragPoint extends BaseComponent {
//     type = 'drag_point';
//     protected point: Point;
//     protected dragState: DragState;
  
//     protected initializeAnchors() {
//       // Geometric anchors
//       this.anchors.set('center', {
//         id: generateId()+'center',
//         type: 'geometric',
//         geometry: this.point,
//         bind: (target) => this.bindCenter(target)
//       });
  
//       // Event anchors
//       ['start', 'during', 'end'].forEach(phase => {
//         this.anchors.set(`drag.${phase}`, {
//           type: 'event',
//           eventType: phase,
//           bind: (target) => this.bindDragEvent(phase, target)
//         });
//       });
//     }
  
//     get center() { return this.createAnchorProxy('center'); }
//     get drag() {
//       return {
//         start: this.createAnchorProxy('drag.start'),
//         during: this.createAnchorProxy('drag.during'),
//         end: this.createAnchorProxy('drag.end')
//       };
//     }
//   }