import { Field } from 'vega-lite/build/src/channeldef';
import { TopLevelSpec, UnitSpec } from 'vega-lite/build/src/spec';
import { generateId } from '../utils/id';
import { AnchorValue } from 'vega';
import { AnchorProxy, AnchorSchema, AnchorIdentifer, SchemaType, SchemaValue } from '../types/anchors';
import { createAnchorProxy, isAnchorProxy } from '../utils/anchorProxy';
import { isComponent } from '../utils/component';
import { BindingManager, VirtualBindingEdge } from '../binding/BindingManager';
import { CompilationContext } from '../binding/binding';
// import { generateComponentSignalName } from './marks/circle';

import { LazyBindingRegistry, LazyComponent } from '../binding/LazyBinding';
import type { BaseChart } from './charts/base';


export type BindingTarget = BaseComponent | AnchorProxy;
export interface Component {
  id: string;
  type: string;
  getSpec(): any;
}


export abstract class BaseComponent {
  protected anchors: Map<string, AnchorProxy> = new Map();
  public schema: Record<string, SchemaType> = {}; // default?
  public configurations: Record<string, SchemaType>[] = [];

  public id: string;
  public isChart: boolean;
  public bindingManager: BindingManager;




  constructor(config: any, configurations: Record<string, any>[] = [], isChart: boolean = false) {
    this.id = generateId();
    this.isChart = isChart;
    this.bindingManager = BindingManager.getInstance();
    this.bindingManager.addComponent(this);

    this.configurations = configurations;

    const bindings = findBindings(config);
    bindings.length && this.addParameterBindings(bindings);
  }

  public addContextBinding(channelName: string, contextValue: any, contextType: 'context' | 'baseContext' = 'context') {
    // Create a virtual binding edge that represents a context input
    const virtualEdge: VirtualBindingEdge = {
      channel: channelName,
      value: contextValue,
      source: contextType
    };

    // Add to binding manager with high priority
    this.bindingManager.addVirtualBinding(channelName, virtualEdge);
  }

  private elaborateBindings(bindingItem: { value: BaseComponent | AnchorProxy, bindingProperty: string }) {
    const { value: childComponent, bindingProperty } = bindingItem;


    // Early return if not a valid component, for now no support for anchor proxies
    if (!isComponent(childComponent)) {
      console.log('what is this', bindingItem.value.toComponent)
      console.warn('Cannot elaborate binding for AnchorProxy', bindingItem);
      return;
    }


    if (childComponent.isLazy) {
      this.bindingManager.addBinding(this.id, childComponent.id, bindingProperty, '_all');
      return;
      // console.log('LAZYCHIDLANCHORSTHRU')
    }



    // Find default configuration for this component
    const defaultParentConfig = this.configurations.find(config => config.default);


    if (!defaultParentConfig) {
      console.warn('No default config found for', bindingProperty, this.id, childComponent.id);
      return;
    }

    let childDefaultConfig = childComponent.configurations?.find(config => config.default);
    // If no parent config found, check if there's a default config with the same key
    // if (!parentConfig && defaultParentConfig) {
    //   // Create a fake config with only the requested accessor
    //   parentConfig = {
    //     id: accessor,
    //     default: true,
    //     schema: {},
    //     transforms: []
    //   };

    //   console.log('AZYCHIDcreating fake config', accessor, defaultParentConfig.schema)
    //   // Check if the accessor exists in the default config's schema
    //   if (defaultParentConfig.schema[accessor]) {
    //     // Copy just this schema entry to our fake config
    //     console.log('AZYCHIDcopying schema', defaultParentConfig.schema[accessor])
    //     parentConfig.schema[accessor] = defaultParentConfig.schema[accessor];
    //   } else {
    //     console.warn('Accessor not found in default config schema:', accessor);
    //   }

    //   if(!childDefaultConfig){
    //     console.log('setting child default config', parentConfig)
    //     childDefaultConfig = parentConfig
    //   }
    // }

   

    if (!childDefaultConfig) {

      console.warn('No default config found for', bindingProperty, this.id, childComponent.id);
      return;
    }

    // Get parent configuration
    const accessor = bindingProperty === '_all' ? defaultParentConfig.id : bindingProperty;
    let parentConfig = this.configurations.find(config => accessor === config.id);

   


    if (!parentConfig) {

      console.warn('No parent config found for', bindingProperty, this.id, childComponent.id);
      return;
    }


    // Create parent anchors
    const parentAnchors = Object.keys(parentConfig.schema).map(schemaKey => ({
      id: {
        componentId: this.id,
        anchorId: `${parentConfig.id}_${schemaKey}`
      },
      anchorSchema: parentConfig.schema[schemaKey]
    }));


    const childAnchors = Object.values(childComponent.getAnchors())
      .filter(anchor => anchor.id.anchorId.includes(childDefaultConfig.id));



    // Create bindings
    parentAnchors.forEach(parentAnchor => {
      childAnchors.forEach(childAnchor => {
        this.bindingManager.addBinding(this.id, childComponent.id, parentAnchor.id.anchorId, childAnchor.id.anchorId);

        const isChartAnchor = (anchorId: string): boolean => {
          // console.log('isChartAnchor',  this)
          // Check if this component is a BaseChart instance
          console.log('about to check if chart', this, this.isChart)
          if (this.isChart) {
            console.log('isChartAnchor', anchorId, anchorId.includes('plot'), this)
            // For BaseChart instances, consider plot anchors as chart anchors
            return true;
          }
          console.log('isChartAnchorNOT', anchorId, anchorId.includes('plot'), this)
          return false;
        }
        if (childAnchor.anchorSchema[childAnchor.id.anchorId].interactive && !isChartAnchor(parentAnchor.id.anchorId)) {
          this.bindingManager.addBinding(childComponent.id, this.id, childAnchor.id.anchorId, parentAnchor.id.anchorId);
        }
      });
    });
  }

  private addParameterBindings(bindings: { value: BaseComponent | AnchorProxy, key: string }[]) {

    bindings.forEach(binding => {
      const bindingProperty = extractBindingProperty(binding.key);

      if (binding.isLazy) {
        this.bindingManager.addBinding(this.id, binding.id, bindingProperty, '_all');
        return;
      }

      const bindingItem = { value: binding.value, bindingProperty: bindingProperty };
      this.elaborateBindings(bindingItem)
    })
  }

  //   public createGroupAnchor(groupName: string, children: string[]) {
  //     this.anchors.set(groupName, {
  //         id: { componentId: this.id, anchorId: groupName },
  //         component: this,
  //         anchorSchema: {
  //             id: groupName, 
  //             type: 'group',
  //             children: children,
  //             interactive: false // Group anchors are always not interactive
  //         },
  //         bind: (target: any) => {
  //             children.forEach(child => 
  //                 this.anchors.get(child)?.bind(target)
  //             );
  //             return this;
  //         },
  //         // group anchors never get compiled as they are expanded
  //         compile: (nodeId?: string)=>{
  //             console.error('Group anchor was compiled', groupName, nodeId)
  //             return {source: 'group',
  //             value: "empty"}
  //         }
  //     });
  // }

  public initializeAnchors() {

    this.anchors.set('_all', this.createAnchorProxy({}, '_all', () => {
      return { source: '', value: '' }
    }));
  }

  // This is the top-level bind function that redirects to _all anchor
  // it is only called if bind is called on a component
  bind(target: BaseComponent | AnchorProxy): BaseComponent {
    // If target is a component, use its _all anchor
    const targetAnchor = isComponent(target)
      ? target.getAnchor('_all')
      : target;

    // Redirect binding to our _all anchor
    return this.getAnchor('_all').bind(targetAnchor);
  }

  // Protected method to get anchor (used by bind)
  public getAnchor(id: string): AnchorProxy {
    const anchor = this.anchors.get(id);
    if (!anchor) {
      throw new Error(`Anchor "${id}" not found`);
    }
    return anchor;
  }

  public getAnchors(): AnchorProxy[] {
    return Array.from(this.anchors.values());
  }

  public setAnchor(anchorId: string, anchor: AnchorProxy) {
    this.anchors.set(anchorId, anchor);
  }




  protected createAnchorProxy(anchor: AnchorSchema, anchorId: string, compileFn?: (nodeId?: string) => SchemaValue): AnchorProxy {
    return createAnchorProxy(this, anchor, anchorId, compileFn);
  }

  abstract compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>>;

  // whenever compile is called, we go to the root and then compile the entire binding tree
  compile(): TopLevelSpec {

    return this.bindingManager.compile(this.id) as TopLevelSpec;
  }
}

const findBindings = (value: any, path: string = ''): { value: BaseComponent | AnchorProxy | LazyComponent, key: string }[] => {
  if (!value) return [];

  // Handle arrays, but skip if path is 'data'
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findBindings(item, `${path}[${index}]`));
  }

  // Check if value is an object with lazy properties
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const lazyBindings = [];
    for (const prop in value) {
      if (value[prop] && value[prop].isLazy) {
        lazyBindings.push({ value: value[prop], key: prop });
      }
    }
    if (lazyBindings.length > 0) {
      return lazyBindings;
    }
  }

  // Only match if value is a Component or AnchorProxy
  if (isComponent(value)) {
    return [{ value, key: path }];
  }

  // Check for AnchorProxy by looking for bind method and anchorSchema property
  if (isAnchorProxy(value)) {
    return [{ value, key: path }];
  }

  // If not a direct match but is an object, check its properties
  if (typeof value === 'object' && path !== 'data') {
    return Object.entries(value).flatMap(([key, v]) =>
      findBindings(v, path ? `${path}.${key}` : key)
    );
  }

  return [];
};

function getTargetId(binding: BaseComponent | AnchorProxy): string {
  return isComponent(binding) ? binding.id : (binding as AnchorProxy).id.componentId;
}
function isAllBind(key: string) {
  return key === 'bind' || (/^bind\[\d+\]$/.test(key) && !key.includes('.'))
}

function extractBindingProperty(key: string) {
  let bindingProperty = key.includes('.') ? key.split('.')[1] : (isAllBind(key) ? '_all' : key);

  // Check if bindingProperty has array index patterns like "bind[0]" or "span[0]"
  const match = bindingProperty.match(/^(\w+)\[(\d+)\]$/);
  if (match) {
    // Extract the base name (like "bind" or "span") and ignore the index
    const baseName = match[1];
    let newBindingProperty = baseName;

    // For "bind" specifically, we want to use "_all"
    if (baseName === 'bind') {
      newBindingProperty = '_all';
    }

    bindingProperty = newBindingProperty;
  }

  return bindingProperty;
}
