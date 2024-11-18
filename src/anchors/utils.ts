import { AnchorSchema, AnchorGroupSchema, AnchorOrGroupSchema } from '../types/anchors';

export function createGeometricAnchorsGroup<T>(
  config: T,
  anchorConfigs: Array<[string, (c: T) => any]>,
  groupName: string
): Map<string, AnchorOrGroupSchema> {
  const anchors = new Map<string, AnchorOrGroupSchema>();

  // Create individual anchors
  anchorConfigs.forEach(([name, getGeometry]) => {
    anchors.set(name, {
      id: name,
      type: 'geometric',
      geometry: getGeometry(config),
    });
  });

  // Create group
  anchors.set(groupName, {
    id: groupName,
    type: 'group',
    children: new Map(anchorConfigs.map(([name]) => {
      const anchor = anchors.get(name);
      if (!anchor) throw new Error(`Anchor "${name}" not found`);
      if ('type' in anchor && anchor.type === 'group') throw new Error(`Nested groups are not allowed: "${name}"`);
      return [name, anchor];
    })),
  });

  return anchors;
}