import { BindingGraph } from "utils/bindingGraph";

interface CompilationQuery {
    componentId: string;
    anchorId: string;
}

// bindingQuery : mark name – find the the parents mark name so I use it as my event target markname property. 
// bindingQuery : initial xy positioning - find the geom of the thing I'm bound to. Use this to set my intiial xy values
// bindingQuery : update xy positioing – find the parameter thatI need to draw my values from (e.g. if a drag is bound to me, I should get my xy values from it)
// bindingQuery : get locational filters – find if I'm bound to a geom that needs to restrain my available values
    // occurance: geom:geom:event. in this case, the middle geom already has bounds defined by the above geom
    // e.g. point= chart.x.axis.bind(alx.point), point.bind(alx.drag) // this should restrict drag updates to only x direction
// bindingQuery : get scale names (ie to invert xy events)


// concept of initial vs. update values


function bindingQuery(compilationTree: BindingGraph, query: CompilationQuery){

}