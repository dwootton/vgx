
// export class Drag extends MouseMove {
//     private config: DragConfig;
  
//     constructor(config: DragConfig = {}) {
//       super();
//       this.config = config;
//       this.initializeAnchors();
//     }
  
   
  
  
//     private initializeAnchors() {
  
//       const mousemove = mousemove(between=[alx.mousedown(), alx.mouseup()])
//       mousemove.after.bind(alx.mouseup())
  
//       // event to event, .bind in this way should be something like 
//       // signal: mousedown
//       // signal: mousemove
//       // signal: mouseup
//       //
  
      
//       // anchor for x,y, 
  
//       // Create geometric anchors for x and y
//       const xAnchor: EventAnchorSchema = {
//         id: 'x',
       
//       };
  
//       const yAnchor: GeometricAnchor<Line> = {
//         id: 'y',
//         type: 'geometric',
//         geometry: {
//           type: 'line',
//           x1: 0,
//           y1: this.config.y,
//           x2: 100,
//           y2: this.config.y
//         }
//       };
  
//       const xyAnchor: GeometricAnchor<Point> = {
//         id: 'xy',
//         type: 'geometric',
//         geometry: {
//           type: 'point',
//           x: this.config.x,
//           y: this.config.y
//         }
//       };
  
//       // Add anchors to component
//       [xAnchor, yAnchor, xyAnchor].forEach(anchor => {
//         this.anchors.set(anchor.id, this.createAnchorProxy(anchor));
//       });
//     }
  
//     compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {
//       if (!parentInfo?.boundAnchor) {
//         return {};
//       }
  
//       const { boundAnchor } = parentInfo;
//       const signalName = `${this.id.replace(/\./g, '_')}_dragDatum`;
  
//       let dragSpec: any = {
//         name: signalName,
//         value: { x: this.config.x, y: this.config.y },
//         on: [{
//           events: {
//             source: "window",
//             type: "pointermove",
//             between: [
//               { type: "pointerdown", markname: "layer_1_marks" },
//               { type: "pointerup", source: "window" }
//             ]
//           }
//         }]
//       };
  
//       // Customize update based on bound anchor
//       switch (boundAnchor.id) {
//         case 'x':
//           dragSpec.on[0].update = "{'x':clamp(x(),range('x')[0],range('x')[1]),'y':" + signalName + ".y}";
//           break;
//         case 'y':
//           dragSpec.on[0].update = "{'x':" + signalName + ".x,'y':clamp(y(),range('y')[1],range('y')[0])}";
//           break;
//         case 'xy':
//           dragSpec.on[0].update = "{'x':clamp(x(),range('x')[0],range('x')[1]),'y':clamp(y(),range('y')[1],range('y')[0])}";
//           break;
//         default:
//           return {};
//       }
  
//       return {
//         spec: {
//           params: [dragSpec]
//         }
//       };
//     }
//   }