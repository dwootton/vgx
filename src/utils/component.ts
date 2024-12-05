import { BaseComponent } from "../components/base";

export function isComponent(obj: any): obj is BaseComponent {
    return obj instanceof BaseComponent;
}
  