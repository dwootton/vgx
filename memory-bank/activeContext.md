# Current Project Context

## Core Components

1. **BindingManager** - Singleton responsible for managing components and their bindings
2. **GraphManager** - Generates and manipulates binding graphs, handles traversal with cycle detection
3. **BaseComponent** - The foundation class for all visual components, enhanced with port and portGroup handling

## Recent Implementations

- Finalized the port type system with hierarchical organization (Channel, Data, Mark, Interaction types)
- Refactored the binding system to use PortType instead of AnchorType for better type safety
- Implemented binding edge class with equality and comparison utilities
- Built GraphManager with cycle detection and edge traversal
- Enhanced BaseComponent to manage ports and portGroups
- Added unit tests for core functionality

## Current Challenges

- Handling special edges that use wildcards or portGroup-specific ports
- Ensuring efficient graph traversal with proper cycle detection
- Expanding special edges that use wildcard port types
- Robust error handling during binding operations
- Registering and managing ports for components

## Key Terminology

- **PortType**: Defines the type of a port (like x, y, color, data, etc.)
- **portGroup**: A specific operational state of a component with a defined set of available ports
- **Binding**: Connection between ports on different components
- **Port vs Anchor**: We've standardized on "port" for the connection points between components, with each port having a specific PortType.
- **Port Reference**: A reference to a specific port on a component, including componentId, portGroup, and portType
- **Binding Edge**: Represents a connection between two port references
- **Expansion Logic**: When a binding uses the special MiscPortType.ALL, the system expands it into multiple concrete port bindings based on compatibility rules.

## Next Tasks

- Complete test coverage for edge expansion
- Implement visualization rendering for the binding graph
- Enhance port compatibility rules
- Add observer pattern for graph change notification 