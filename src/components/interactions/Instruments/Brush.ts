import { CompositeComponent } from "components/composite";
import { IntervalSelect } from "../interval-select";
import { Rect } from "../../marks/rect";
import { BindingManager } from "../../../binding/BindingManager";

export class Brush {
    private composite: CompositeComponent;
    private intervalSelect: IntervalSelect;
    private rect: Rect;

    constructor() {
        this.intervalSelect = new IntervalSelect();
        this.rect = new Rect();
        
        this.composite = new CompositeComponent(this.intervalSelect);
        this.composite.addChildComponent(this.rect);

        // Set up internal bindings
        BindingManager.getInstance().addBinding(
            this.intervalSelect.id,
            this.rect.id,
            'x', 'x'
        );
        
        BindingManager.getInstance().addBinding(
            this.intervalSelect.id,
            this.rect.id,
            'y', 'y'
        );
    }

    // Expose composite functionality
    getAnchor(anchorId: string) {
        return this.composite.getAnchor(anchorId);
    }

    addContextBinding(channel: string, value: any) {
        this.composite.addContextBinding(channel, value);
    }

    get id() {
        return this.composite.id;
    }
}
