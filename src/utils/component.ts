import { LazyComponent } from "../binding/LazyBinding";
import { BaseComponent } from "../components/base";

export function isComponent(obj: any): obj is BaseComponent {
    if((obj.isLazy)){
        console.log('is lazy a Component', obj, obj instanceof BaseComponent)
    }
    return obj instanceof BaseComponent || obj.isLazy;
}
  

export function generateComponentSignalName(id:string){
    return `${id}_alx_data`
}
