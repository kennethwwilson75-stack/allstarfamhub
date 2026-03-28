import type { Connector } from '@allstarfamhub/shared';

import { canvasConnector } from './connectors/canvas.js';
import { infiniteCampusConnector } from './connectors/infinite-campus.js';
import { parentSquareConnector } from './connectors/parentsquare.js';
import { sportsYouConnector } from './connectors/sportsyou.js';
import { googleClassroomConnector } from './connectors/google-classroom.js';
import { remindConnector } from './connectors/remind.js';
import { blackboardConnector } from './connectors/blackboard.js';
import { schoologyConnector } from './connectors/schoology.js';
import { icalGenericConnector } from './connectors/ical-generic.js';
import { emailGenericConnector } from './connectors/email-generic.js';

/** Registry of all available connectors, keyed by connector ID */
const connectorRegistry: ReadonlyMap<string, Connector> = new Map<string, Connector>([
  [canvasConnector.id, canvasConnector],
  [infiniteCampusConnector.id, infiniteCampusConnector],
  [parentSquareConnector.id, parentSquareConnector],
  [sportsYouConnector.id, sportsYouConnector],
  [googleClassroomConnector.id, googleClassroomConnector],
  [remindConnector.id, remindConnector],
  [blackboardConnector.id, blackboardConnector],
  [schoologyConnector.id, schoologyConnector],
  [icalGenericConnector.id, icalGenericConnector],
  [emailGenericConnector.id, emailGenericConnector],
]);

/**
 * Get a connector by its ID.
 * @throws Error if the connector is not found.
 */
export function getConnector(id: string): Connector {
  const connector = connectorRegistry.get(id);
  if (!connector) {
    throw new Error(`Connector not found: ${id}`);
  }
  return connector;
}

/**
 * Get a connector by ID, or undefined if not found.
 */
export function findConnector(id: string): Connector | undefined {
  return connectorRegistry.get(id);
}

/**
 * List all registered connectors.
 */
export function listConnectors(): Connector[] {
  return Array.from(connectorRegistry.values());
}

/**
 * List all registered connector IDs.
 */
export function listConnectorIds(): string[] {
  return Array.from(connectorRegistry.keys());
}
