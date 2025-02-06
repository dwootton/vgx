import { IntervalSelect } from "../interval-select";
import { Drag } from "../drag";
import { Rect } from "../../marks/rect";
import { BindingManager } from "../../../binding/BindingManager";

export class Brush {
    constructor() {
        const rect = new Rect({y1:0, y2:100});
        // const intervalSelect = new IntervalSelect();
        const drag = new Drag();
        const drag2 = new Drag();
        const bindingManager = BindingManager.getInstance();
        
        // Set up internal bindings
        bindingManager.addBinding(
            drag.id,
            rect.id,
            'start_x', 'x1'
        );

        bindingManager.addBinding(
            drag.id,
            rect.id,
            'x', 'x2'
        );


        // bindingManager.addBinding(
        //     rect.id,
        //     drag2.id,
        //     'x', 'x2'
        // );

        // // create anchor, this will be a proxy for how to access other data
        // drag.createAnchor('x1',"start_x");
        // drag.createAnchor('x2',"x");

        // drag.createAnchor





        // how do you add nested bindings? Like drag.start.x1 


        // drag.x
        // drag.interval.x [xfield,xfield]
        //drag.x // xfield
        // drag // xfield, yfield


        //const drag2 = new Drag();
        //drag2.translate // {dx,dy} == alter existing's x and y values via drag. 
        // my concern here is that all of my demos were examples with WAYY too much magic. 
        // the realtiy is that my abstractions aren't matching it. 


       
        // types: marks, types: params
        // param:param => edit, mark:param => reify , param:mark => markProperties (mark properties)
        // drag.x->[rect.x1,rect.x2] (a single value on both)
        



        // issue: interval drag vs drag. 
        // {x,y} of current mouse poisition
        // {start,stop} 

        // drag1:rect:drag2 -- drag 1 sets rect bounds, drag 2 modifies rect's x

        // brush:rect:drag -- brush has start, stop, etc, drag then modifies x values
        // what we're missing is a generator that does 
            // "create brush_store from drag intx"
                // {x1:drag.x (init), y1:drag.y (init)}
                // {x2:drag.x  mouseover...}
            // "create lasso_store from drag intx"
                // {append(dragx), append(dragy)}

        // in this case, brush is appended onto an action  to populate brushstore
        // 

        // here's an issue: because interactive edges just look like
        // populate the edge both ways, its not possible to do things that 
        // are not bidirectional with interaction. Thus, its not possible to 
        // defer what is like
        // drag:rect (drag to create rect) and rect:drag (rect that is draggable)



        // drag:rect:drag-translate 

        // drag.x -> should always just move around rect's x (adj)

        // drag.x on rect.x1, should move around rect.x2
        // drag.x.down, should set rect.x1

        // drag1->rect,
        // rect->drag2 (markname)
        // drag2->rect 
        // how do we differentiate drag1->rect (set bounds), drag2->rect (translate)

        // when drag is on mark name, default becomes translate?





        // I guess then maybe we add a rect.x property, which corresponds with the mid
        // point of the rect.x1, x2. when the .x property is bound with a single, it 
        // should replce the translate mid point. 




        // rect.x : drag.x 
        // [x1,x2]:
        
        // rect.x = drag.x
        //  x1,x2 : x
        // [x1,x2] : x


        // here



        // const drag2 = new Drag();
        // // then lets add a drag binding to the rect
        // BindingManager.getInstance().addBinding(
        //     rect.id,
        //     drag2.id,
        //     'markname', 'markname'
        // );

        // commenting out for now as y
        // BindingManager.getInstance().addBinding(
        //     intervalSelect.id,
        //     rect.id,
        //     'y', 'y'
        // );

        //const intervalDrag = new Drag(); TODO: add drag to brush body

        return drag;
    }
}
