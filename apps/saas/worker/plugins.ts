import { authPlugin } from '@ship/auth';
import type { ShipPlugin } from '@ship/plugin-sdk';

export const plugins = [authPlugin] satisfies readonly ShipPlugin[];
