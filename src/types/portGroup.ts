import { PortConfiguration } from 'components/portExpressions';
import { PortType } from './portTypes';

export interface PortGroup {
    id: string;
    name: string;
    ports: Map<string, PortConfiguration>;
}

// Rename the file to portGroups.ts after this change 