import { getBcbAdapter } from './bcb.adapter.js';
import { getComplianceHandoffAdapter } from './compliance-handoff.adapter.js';
import { RoutingAdapterFactory } from './routing.adapter.js';

export { getBcbAdapter, getComplianceHandoffAdapter, RoutingAdapterFactory };

export function getFiatRailsAdapter() {
  return getBcbAdapter();
}

export function getRoutingAdapter() {
  return RoutingAdapterFactory.getAdapter();
}
