// @allstarfamhub/connectors — integration connector plugins

// Registry
export { getConnector, findConnector, listConnectors, listConnectorIds } from './registry.js';

// Individual connectors (for direct imports when needed)
export { canvasConnector } from './connectors/canvas.js';
export { infiniteCampusConnector } from './connectors/infinite-campus.js';
export { parentSquareConnector } from './connectors/parentsquare.js';
export { sportsYouConnector, detectEventChange } from './connectors/sportsyou.js';
export { googleClassroomConnector } from './connectors/google-classroom.js';
export { remindConnector } from './connectors/remind.js';
export { blackboardConnector } from './connectors/blackboard.js';
export { schoologyConnector } from './connectors/schoology.js';
export { icalGenericConnector } from './connectors/ical-generic.js';
export {
  emailGenericConnector,
  extractDatesFromText,
  extractTimesFromText,
} from './connectors/email-generic.js';

// Re-export types from shared for convenience
export type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
  RawEventData,
} from '@allstarfamhub/shared';
