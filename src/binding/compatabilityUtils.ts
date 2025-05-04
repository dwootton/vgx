import { PortType, ChannelType, DataPortType, MarkPortType, InteractionPortType, MiscPortType } from '../types/portTypes';

export function isPortTypeCompatible(sourcePortType: PortType, targetPortType: PortType): boolean {

    const portTypeMap: Record<PortType, PortType[]> = {
        [ChannelType.X]: [ChannelType.X, ChannelType.X1, ChannelType.X2, ChannelType.MID_X],
        [ChannelType.Y]: [ChannelType.Y, ChannelType.Y1, ChannelType.Y2, ChannelType.MID_Y],
        [ChannelType.COLOR]: [ChannelType.COLOR],
        [ChannelType.SIZE]: [ChannelType.SIZE],
        [ChannelType.SHAPE]: [ChannelType.SHAPE],
        [ChannelType.OPACITY]: [ChannelType.OPACITY],
        [ChannelType.TEXT]: [ChannelType.TEXT],
        [ChannelType.X1]: [ChannelType.X],
        [ChannelType.X2]: [ChannelType.X],
        [ChannelType.Y1]: [ChannelType.Y],
        [ChannelType.Y2]: [ChannelType.Y],
        [InteractionPortType.SELECTION]: [InteractionPortType.SELECTION],
        [InteractionPortType.FILTER]: [InteractionPortType.FILTER],
        [InteractionPortType.SELECTION_NAME]: [InteractionPortType.SELECTION_NAME],
        [DataPortType.DATA]: [DataPortType.DATA],
        [DataPortType.FIELD]: [DataPortType.FIELD],
        [DataPortType.DATA_TRANSFORMS]: [DataPortType.DATA_TRANSFORMS],
        [MarkPortType.MARK_NAME]: [MarkPortType.MARK_NAME],
        [MarkPortType.MARK_TYPE]: [MarkPortType.MARK_TYPE],
        [MiscPortType.OTHER]: [MiscPortType.OTHER],
        [MiscPortType.ALL]: [
            ...Object.values(ChannelType),
            ...Object.values(DataPortType),
            ...Object.values(MarkPortType),
            ...Object.values(InteractionPortType),
            MiscPortType.OTHER
        ],
        [ChannelType.WIDTH]: [ChannelType.WIDTH],
        [ChannelType.HEIGHT]: [ChannelType.HEIGHT],
        [ChannelType.MID_X]: [ChannelType.X, ChannelType.X1, ChannelType.X2], // MID_X is a derived port and can be bound to X, X1, X2
        [ChannelType.MID_Y]: [ChannelType.Y, ChannelType.Y1, ChannelType.Y2],
        [DataPortType.XFIELD]: [DataPortType.XFIELD],
        [DataPortType.YFIELD]: [DataPortType.YFIELD]
    }

    return portTypeMap[sourcePortType]?.includes(targetPortType) || false;
}

export function getGenericPortTypeFromId(encodingValue: string): PortType {
    const portMap: Record<string, PortType> = {
        "x": ChannelType.X,
        "y": ChannelType.Y,
        "x1": ChannelType.X1,
        "y1": ChannelType.Y1,
        "x2": ChannelType.X2,
        "y2": ChannelType.Y2,
        "xMid": ChannelType.X,
        "yMid": ChannelType.Y,
        "color": ChannelType.COLOR,
        "size": ChannelType.SIZE,
        "shape": ChannelType.SHAPE,
        "text": ChannelType.TEXT,
        "data": DataPortType.DATA,
        "markName": MarkPortType.MARK_NAME,
        "markType": MarkPortType.MARK_TYPE,
        "selection": InteractionPortType.SELECTION,
        "selectionName": InteractionPortType.SELECTION_NAME,
        "filter": InteractionPortType.FILTER,
        "_all": MiscPortType.ALL
    };
    
    return portMap[encodingValue] || MiscPortType.OTHER;
}

export function extractPortType(portType: string): PortType {
    if (portType === '_all') return MiscPortType.ALL;

    if (portType.includes('markName')) {
        return MarkPortType.MARK_NAME;
    }
    if (portType.includes('selectionName')) {
        return InteractionPortType.SELECTION_NAME;
    }

    if (portType.includes('_internal')) {
        return extractPortType(portType.split('_internal')[0]);
    }

    // Handle special cases like x1, x2, y1, y2
    if (portType === 'x1') return ChannelType.X;
    if (portType === 'x2') return ChannelType.X;
    if (portType === 'y1') return ChannelType.Y;
    if (portType === 'y2') return ChannelType.Y;

    // Check if it's a simple channel/port name
    const allValues = [
        ...Object.values(ChannelType),
        ...Object.values(DataPortType),
        ...Object.values(MarkPortType),
        ...Object.values(InteractionPortType),
        ...Object.values(MiscPortType)
    ];
    
    // Check if the portType is in our list of valid port types
    if (allValues.includes(portType as any)) {
        // We know it's a valid PortType because we just checked
        return portType as PortType;
    }

    // For complex IDs like 'point_x', 'span_pla_x', extract the last part
    const parts = portType.split('_');
    const lastPart = parts[parts.length - 1];

    // Check if the last part is a valid port type
    if (allValues.includes(lastPart as any)) {
        // We know it's a valid PortType because we just checked
        return lastPart as PortType;
    }

    // If we can't determine a specific port type, return a default
    return MiscPortType.OTHER;
}
