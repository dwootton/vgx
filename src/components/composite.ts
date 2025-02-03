import { BaseComponent } from "./base";
import { BindingManager } from "../binding/BindingManager";

export class CompositeComponent {
    private primary: BaseComponent;
    private children: BaseComponent[] = [];

    constructor(primary: BaseComponent) {
        this.primary = primary;
        BindingManager.getInstance().addComponent(primary);
    }

    addChildComponent(component: BaseComponent) {
        this.children.push(component);
        BindingManager.getInstance().addComponent(component);
    }

    // Proxy all binding interactions to primary component
    getAnchor(anchorId: string) {
        return this.primary.getAnchor(anchorId);
    }

    addContextBinding(channel: string, value: any) {
        this.primary.addContextBinding(channel, value);
    }

    get id() {
        return this.primary.id;
    }
} 