/**
 * TraceInsights Component
 * Displays comprehensive trace analysis with drill-down to sessions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getTraceInsights } from '../../../services/api/testMonitorApi';
import type { TraceInsightsResponse } from '../../../types/testMonitor.types';

// ============================================================================
// TYPES
// ============================================================================

interface TraceInsightsProps {
  configId: number;
  fromDate?: string;
  toDate?: string;
  onViewSessions: (sessionIds: string[], issueType: string, issueDescription: string) => void;
  // Caching props - lift state up to parent for persistence
  cachedInsights?: TraceInsightsResponse | null;
  cachedLastDays?: number;
  onInsightsLoaded?: (insights: TraceInsightsResponse, lastDays: number) => void;
}

interface IssueRow {
  key: string;
  name: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  count: number;
  sessionCount: number;
  sessionIds: string[];
  description: string;
  extra?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    P0: 'bg-red-100 text-red-800 border-red-200',
    P1: 'bg-orange-100 text-orange-800 border-orange-200',
    P2: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    P3: 'bg-green-100 text-green-800 border-green-200',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colors[priority] || 'bg-gray-100 text-gray-800'}`}>
      {priority}
    </span>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, subtitle, trend }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-sm font-medium text-gray-500">{title}</div>
      <div className="mt-1 flex items-baseline">
        <span className="text-2xl font-semibold text-gray-900">{value}</span>
        {trend && (
          <span className={`ml-2 text-sm ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}
    </div>
  );
};

const Spinner: React.FC = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TraceInsights: React.FC<TraceInsightsProps> = ({
  configId,
  fromDate: propFromDate,
  toDate: propToDate,
  onViewSessions,
  cachedInsights,
  cachedLastDays,
  onInsightsLoaded,
}) => {
  const [insights, setInsights] = useState<TraceInsightsResponse | null>(cachedInsights || null);
  const [loading, setLoading] = useState(!cachedInsights);
  const [error, setError] = useState<string | null>(null);
  const [lastDays, setLastDays] = useState<number>(cachedLastDays || 7);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadInsights = useCallback(async (forceRefresh = false) => {
    if (!configId) return;

    // If we have cached data and this is not a refresh, don't fetch
    if (cachedInsights && !forceRefresh && insights) {
      return;
    }

    try {
      setLoading(!forceRefresh);
      setIsRefreshing(forceRefresh);
      setError(null);
      const data = await getTraceInsights({
        configId,
        fromDate: propFromDate,
        toDate: propToDate,
        lastDays: propFromDate ? undefined : lastDays,
      });
      setInsights(data);
      // Notify parent of loaded data for caching
      if (onInsightsLoaded) {
        onInsightsLoaded(data, lastDays);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [configId, propFromDate, propToDate, lastDays, cachedInsights, insights, onInsightsLoaded]);

  // Only fetch on mount if we don't have cached data
  useEffect(() => {
    if (!cachedInsights) {
      loadInsights();
    }
  }, [configId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle time range change - always fetch fresh data
  const handleTimeRangeChange = useCallback((days: number) => {
    setLastDays(days);
    // Fetch fresh data when time range changes
    setTimeout(() => loadInsights(true), 0);
  }, [loadInsights]);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-gray-500 text-center py-8">
        No insights data available
      </div>
    );
  }

  // Build issue rows
  const issueRows: IssueRow[] = [
    {
      key: 'emptyPatientGuid',
      name: 'Empty patientGUID Bug',
      priority: 'P0',
      count: insights.issues.emptyPatientGuid.count,
      sessionCount: insights.issues.emptyPatientGuid.sessionIds.length,
      sessionIds: insights.issues.emptyPatientGuid.sessionIds,
      description: insights.issues.emptyPatientGuid.description,
      extra: `${insights.issues.emptyPatientGuid.patientsCreatedInSameTrace} with patient in same trace`,
    },
    {
      key: 'apiErrors',
      name: 'Cloud9 API Errors',
      priority: 'P1',
      count: insights.issues.apiErrors.count,
      sessionCount: insights.issues.apiErrors.sessionIds.length,
      sessionIds: insights.issues.apiErrors.sessionIds,
      description: insights.issues.apiErrors.description,
      extra: `502: ${insights.issues.apiErrors.breakdown.http502}, 500: ${insights.issues.apiErrors.breakdown.http500}`,
    },
    {
      key: 'slotFetchFailures',
      name: 'Slot Fetch Failures',
      priority: 'P1',
      count: insights.issues.slotFetchFailures.count,
      sessionCount: insights.issues.slotFetchFailures.sessionIds.length,
      sessionIds: insights.issues.slotFetchFailures.sessionIds,
      description: insights.issues.slotFetchFailures.description,
      extra: `${insights.issues.slotFetchFailures.failureRate}% failure rate`,
    },
    {
      key: 'missingSlotData',
      name: 'Missing Slot Data Errors',
      priority: 'P2',
      count: insights.issues.missingSlotData.count,
      sessionCount: insights.issues.missingSlotData.sessionIds.length,
      sessionIds: insights.issues.missingSlotData.sessionIds,
      description: insights.issues.missingSlotData.description,
      extra: `${insights.issues.missingSlotData.recoveryRate}% recovery rate`,
    },
    {
      key: 'sessionAbandonment',
      name: 'Session Abandonment',
      priority: 'P2',
      count: insights.issues.sessionAbandonment.count,
      sessionCount: insights.issues.sessionAbandonment.sessionIds.length,
      sessionIds: insights.issues.sessionAbandonment.sessionIds,
      description: insights.issues.sessionAbandonment.description,
      extra: `${insights.issues.sessionAbandonment.rate}% of sessions`,
    },
    {
      key: 'excessiveConfirmations',
      name: 'Excessive Confirmations',
      priority: 'P3',
      count: insights.issues.excessiveConfirmations.count,
      sessionCount: insights.issues.excessiveConfirmations.sessionIds.length,
      sessionIds: insights.issues.excessiveConfirmations.sessionIds,
      description: insights.issues.excessiveConfirmations.description,
      extra: `Avg ${insights.issues.excessiveConfirmations.avgConfirmations} confirmations`,
    },
    {
      key: 'longSessions',
      name: 'Long Sessions (19+ turns)',
      priority: 'P3',
      count: insights.issues.longSessions.count,
      sessionCount: insights.issues.longSessions.sessionIds.length,
      sessionIds: insights.issues.longSessions.sessionIds,
      description: insights.issues.longSessions.description,
      extra: `Avg ${insights.issues.longSessions.avgTurns} turns, $${insights.issues.longSessions.costImpact.toFixed(2)} cost`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Time range:</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => handleTimeRangeChange(days)}
                disabled={isRefreshing}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  lastDays === days
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } ${days !== 7 ? 'border-l border-gray-200' : ''} ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>
            {new Date(insights.timeframe.fromDate).toLocaleDateString()} - {new Date(insights.timeframe.toDate).toLocaleDateString()}
            {' '}({insights.timeframe.daysCount} days)
          </span>
          <button
            onClick={() => loadInsights(true)}
            disabled={isRefreshing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              isRefreshing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800'
            }`}
          >
            {isRefreshing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sessions"
          value={insights.overview.totalSessions}
          subtitle={`${insights.overview.totalTraces} traces`}
        />
        <MetricCard
          title="Successful Bookings"
          value={insights.overview.successfulBookings}
          subtitle={`${insights.overview.patientsCreated} patients created`}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${insights.overview.patientToBookingConversion}%`}
          subtitle="Patient to booking"
        />
        <MetricCard
          title="Total Cost"
          value={`$${insights.overview.totalCost.toFixed(2)}`}
          subtitle={`$${insights.overview.avgCostPerSession.toFixed(4)} avg/session`}
        />
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Issues Identified</h3>
          <p className="text-xs text-gray-500 mt-1">Click "View Sessions" to see affected conversations</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occurrences</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {issueRows.map((row) => (
                <tr key={row.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{row.name}</div>
                    <div className="text-xs text-gray-500">{row.description}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {row.count}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {row.sessionCount}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {row.extra}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.sessionCount > 0 && (
                      <button
                        onClick={() => onViewSessions(row.sessionIds, row.name, row.description)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Sessions
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Length Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Session Length Distribution</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-4">
            {(['abandoned', 'partial', 'complete', 'long'] as const).map((category) => {
              const data = insights.sessionLengthDistribution[category];
              const costData = insights.costAnalysis.bySessionType[category];
              const total = insights.overview.totalSessions || 1;
              const percentage = ((data.count / total) * 100).toFixed(1);

              return (
                <div key={category} className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{data.count}</div>
                  <div className="text-xs text-gray-500 capitalize">{category}</div>
                  <div className="text-xs text-gray-400">{data.range}</div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        category === 'complete' ? 'bg-green-500' :
                        category === 'long' ? 'bg-orange-500' :
                        category === 'abandoned' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{percentage}%</div>
                  {costData && (
                    <div className="mt-1 text-xs text-gray-400">
                      ${costData.avgCost.toFixed(3)}/session
                    </div>
                  )}
                  {data.sessionIds.length > 0 && (
                    <button
                      onClick={() => onViewSessions(data.sessionIds, `${category} sessions`, data.range)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tool Call Stats */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Tool Call Statistics</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'chordOrthoPatient', name: 'Patient Lookup', data: insights.toolCallStats.chordOrthoPatient },
              { key: 'scheduleAppointmentOrtho', name: 'Scheduling', data: insights.toolCallStats.scheduleAppointmentOrtho },
              { key: 'currentDateTime', name: 'Date/Time', data: insights.toolCallStats.currentDateTime },
              { key: 'handleEscalation', name: 'Escalations', data: insights.toolCallStats.handleEscalation },
            ].map((tool) => (
              <div key={tool.key} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">{tool.data.count}</div>
                <div className="text-xs font-medium text-gray-700">{tool.name}</div>
                <div className="text-xs text-gray-500">
                  {tool.data.avgLatencyMs > 0 ? `${tool.data.avgLatencyMs.toFixed(1)}ms avg` : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Escalations */}
      {insights.escalations.count > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Escalations ({insights.escalations.count})</h3>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {insights.escalations.reasons.map((reason, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700 truncate" style={{ maxWidth: '80%' }}>
                    {reason.reason}
                  </span>
                  <span className="text-gray-500 font-medium">{reason.count}</span>
                </div>
              ))}
            </div>
            {insights.escalations.sessionIds.length > 0 && (
              <button
                onClick={() => onViewSessions(
                  insights.escalations.sessionIds,
                  'Escalated Sessions',
                  'Sessions that triggered escalation to human agent'
                )}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                View All Escalated Sessions
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TraceInsights;
