import { BaseComponent } from "../components/base";

export function isComponent(obj: any): obj is BaseComponent {
    return obj instanceof BaseComponent;
}
  

export function generateComponentSignalName(id:string){
    return `${id}_alx_data`
}
