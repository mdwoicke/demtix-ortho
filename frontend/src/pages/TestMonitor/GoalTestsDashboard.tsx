/**
 * Goal Tests Dashboard
 *
 * Layout similar to TestMonitorDashboard with:
 * - Left panel: Test categories with checkboxes + Execution config
 * - Right panel:
 *   - When no test selected: Execution Status + Recent Runs
 *   - When test selected: Test details (swaps in) until Cancel clicked
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clsx } from 'clsx';

import { PersonaEditor } from '../../components/features/testCases/PersonaEditor';
import { GoalsEditor } from '../../components/features/testCases/GoalsEditor';
import { ResponseConfigEditor } from '../../components/features/testCases/ResponseConfigEditor';
import { PageHeader } from '../../components/layout';
import { Button, Card } from '../../components/ui';

import type { AppDispatch, RootState } from '../../store/store';
import {
  fetchGoalTestCases,
  createGoalTestCase,
  updateGoalTestCase,
  runGoalTests,
  selectTestCase,
  toggleTestCaseSelection,
  startEditing,
  startCreating,
  cancelEditing,
  setFilters,
  toggleCategoryCollapse,
  selectFilteredGoalTestCases,
  selectTestCasesByCategory,
  selectSelectionState,
} from '../../store/slices/goalTestCasesSlice';
import {
  fetchTestRuns,
  selectTestRuns,
} from '../../store/slices/testMonitorSlice';
import { subscribeToExecution } from '../../services/api/testMonitorApi';
import type { ExecutionStreamEvent } from '../../services/api/testMonitorApi';

import type {
  GoalTestCaseRecord,
  UserPersonaDTO,
  ResponseConfigDTO,
  TestCategory,
} from '../../types/testMonitor.types';

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
  Search: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Play: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  User: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Target: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Tag: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Monitor: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  X: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const CATEGORY_CONFIG: Record<TestCategory, {
  label: string;
  description: string;
  icon: React.ReactNode;
  colors: {
    text: string;
    bg: string;
    border: string;
    badge: string;
    accent: string;
  };
}> = {
  'happy-path': {
    label: 'Happy Path',
    description: 'Standard user flows',
    icon: <Icons.CheckCircle />,
    colors: {
      text: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-800',
      badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
      accent: 'bg-emerald-500',
    },
  },
  'edge-case': {
    label: 'Edge Cases',
    description: 'Boundary conditions and unusual inputs',
    icon: <Icons.AlertTriangle />,
    colors: {
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
      badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
      accent: 'bg-amber-500',
    },
  },
  'error-handling': {
    label: 'Error Handling',
    description: 'Error recovery and validation',
    icon: <Icons.XCircle />,
    colors: {
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-200 dark:border-rose-800',
      badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300',
      accent: 'bg-rose-500',
    },
  },
};

const CATEGORIES: TestCategory[] = ['happy-path', 'edge-case', 'error-handling'];

// ============================================================================
// EXECUTION STATE
// ============================================================================

interface ExecutionState {
  isExecuting: boolean;
  runId: string | null;
  progress: {
    total: number;
    completed: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  workers: Array<{
    workerId: number;
    status: string;
    currentTestName: string | null;
  }>;
}

// ============================================================================
// TEST CASE LIST ITEM
// ============================================================================

function TestCaseListItem({
  testCase,
  isSelected,
  isActive,
  isRunning,
  onSelect,
  onClick,
}: {
  testCase: GoalTestCaseRecord;
  isSelected: boolean;
  isActive: boolean;
  isRunning: boolean;
  onSelect: () => void;
  onClick: () => void;
}) {
  const config = CATEGORY_CONFIG[testCase.category as TestCategory];

  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative rounded-lg border p-3 cursor-pointer transition-all duration-200',
        isRunning
          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 animate-pulse'
          : isActive
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
        testCase.isArchived && 'opacity-60'
      )}
    >
      {/* Category accent bar */}
      <div className={clsx('absolute left-0 top-3 bottom-3 w-1 rounded-r', config.colors.accent)} />

      <div className="flex items-start gap-3 pl-3">
        {/* Checkbox */}
        <div className="pt-0.5" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* ID Badge + Name */}
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx(
              'inline-flex px-1.5 py-0.5 text-xs font-mono font-medium rounded',
              config.colors.badge
            )}>
              {testCase.caseId}
            </span>
            {isRunning && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold bg-emerald-500 text-white rounded">
                <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                Running
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {testCase.name || 'Untitled Test'}
          </h4>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Icons.User />
              {testCase.persona?.name || 'No persona'}
            </span>
            <span className="flex items-center gap-1">
              <Icons.Target />
              {testCase.goals?.length || 0} goals
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CATEGORY SECTION (LEFT PANEL)
// ============================================================================

function CategorySection({
  category,
  testCases,
  isCollapsed,
  selectedIds,
  activeId,
  runningCaseIds,
  onToggleCollapse,
  onSelectTestCase,
  onToggleSelection,
}: {
  category: TestCategory;
  testCases: GoalTestCaseRecord[];
  isCollapsed: boolean;
  selectedIds: string[];
  activeId: string | null;
  runningCaseIds: string[];
  onToggleCollapse: () => void;
  onSelectTestCase: (id: string) => void;
  onToggleSelection: (id: string) => void;
}) {
  const config = CATEGORY_CONFIG[category];

  return (
    <div className="mb-4">
      {/* Category Header */}
      <button
        onClick={onToggleCollapse}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors',
          config.colors.bg,
          'border',
          config.colors.border,
          'hover:opacity-90'
        )}
      >
        <div className="flex items-center gap-2">
          <span className={config.colors.text}>
            {isCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
          </span>
          <span className={clsx('text-sm font-semibold', config.colors.text)}>
            {config.label}
          </span>
        </div>
        <span className={clsx(
          'px-2 py-0.5 text-xs font-bold rounded-full',
          config.colors.badge
        )}>
          {testCases.length}
        </span>
      </button>

      {/* Test Cases List */}
      {!isCollapsed && testCases.length > 0 && (
        <div className="mt-2 space-y-2">
          {testCases.map((testCase) => (
            <TestCaseListItem
              key={testCase.id}
              testCase={testCase}
              isSelected={selectedIds.includes(testCase.id)}
              isActive={activeId === testCase.id}
              isRunning={runningCaseIds.includes(testCase.caseId)}
              onSelect={() => onToggleSelection(testCase.id)}
              onClick={() => onSelectTestCase(testCase.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function GoalTestsDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  // Redux state
  const state = useSelector((state: RootState) => state.goalTestCases);
  const testCases = state?.testCases || [];
  const loading = state?.loading || false;
  const running = state?.running || false;
  const runningCaseIds = state?.runningCaseIds || [];
  const lastRunId = state?.lastRunId || null;
  const error = state?.error || null;
  const selectedTestCase = state?.selectedTestCase || null;
  const selectedTestCaseId = selectedTestCase?.id || null;
  const selectedTestCaseIds = state?.selectedTestCaseIds || [];
  const editingTestCase = state?.editingTestCase || null;
  const isCreating = state?.isCreating || false;
  const collapsedCategories = state?.collapsedCategories || [];

  const filteredTestCases = useSelector(selectFilteredGoalTestCases) || [];
  const testCasesByCategory = useSelector(selectTestCasesByCategory) || {};
  const selectionState = useSelector(selectSelectionState) || { hasSelection: false, selectedCount: 0 };
  const recentRuns = useSelector(selectTestRuns) || [];

  // Local state
  const [activeTab, setActiveTab] = useState<'persona' | 'goals' | 'config'>('persona');
  const [searchQuery, setSearchQuery] = useState('');
  const [concurrency, setConcurrency] = useState(1);
  const [runCount, setRunCount] = useState(1);
  const [testTimeout, setTestTimeout] = useState(60000);
  const [retryFailed, setRetryFailed] = useState(false);
  const [enableSemanticEval, setEnableSemanticEval] = useState(true);

  // Execution state
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isExecuting: false,
    runId: null,
    progress: { total: 0, completed: 0, passed: 0, failed: 0, skipped: 0 },
    workers: [],
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  // Compute selected test count
  const selectedTestCount = useMemo(() => {
    return filteredTestCases.filter(tc => selectedTestCaseIds.includes(tc.id)).length;
  }, [filteredTestCases, selectedTestCaseIds]);

  // Handle SSE events
  const handleExecutionEvent = useCallback((event: ExecutionStreamEvent) => {
    console.log('[SSE Event]', event.type, event.data);

    switch (event.type) {
      case 'progress-update':
        setExecutionState(prev => ({
          ...prev,
          progress: event.data,
        }));
        break;
      case 'workers-update':
        setExecutionState(prev => ({
          ...prev,
          workers: event.data,
        }));
        break;
      case 'worker-status':
        setExecutionState(prev => ({
          ...prev,
          workers: prev.workers.map(w =>
            w.workerId === event.data.workerId
              ? { ...w, ...event.data }
              : w
          ),
        }));
        break;
      case 'execution-completed':
      case 'execution-stopped':
      case 'complete':
        setExecutionState(prev => ({
          ...prev,
          isExecuting: false,
        }));
        dispatch(fetchTestRuns({}));
        break;
      case 'error':
      case 'execution-error':
        console.error('[SSE Error]', event.data);
        break;
    }
  }, [dispatch]);

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchGoalTestCases());
    dispatch(fetchTestRuns({}));
  }, [dispatch]);

  // Subscribe to SSE when execution starts
  useEffect(() => {
    if (executionState.isExecuting && executionState.runId && !eventSourceRef.current) {
      console.log('[SSE] Subscribing to execution stream:', executionState.runId);
      eventSourceRef.current = subscribeToExecution(
        executionState.runId,
        handleExecutionEvent,
        (error) => console.error('[SSE] Connection error:', error)
      );
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [executionState.isExecuting, executionState.runId, handleExecutionEvent]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(setFilters({ search: searchQuery }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, dispatch]);

  // Get currently active test case for editing
  const activeTestCase = useMemo(() => {
    return editingTestCase || selectedTestCase;
  }, [selectedTestCase, editingTestCase]);

  // Handlers
  const handleStartExecution = async () => {
    try {
      const baseCaseIds = selectedTestCount > 0
        ? filteredTestCases.filter(tc => selectedTestCaseIds.includes(tc.id)).map(tc => tc.caseId)
        : filteredTestCases.map(tc => tc.caseId);

      // Repeat case IDs based on runCount
      const caseIds = runCount > 1
        ? Array.from({ length: runCount }, () => baseCaseIds).flat()
        : baseCaseIds;

      const result = await dispatch(runGoalTests({
        caseIds,
        config: { concurrency, timeout: testTimeout, retryFailedTests: retryFailed },
      })).unwrap();

      setExecutionState({
        isExecuting: true,
        runId: result.runId,
        progress: { total: result.caseIds.length, completed: 0, passed: 0, failed: 0, skipped: 0 },
        workers: Array.from({ length: concurrency }, (_, i) => ({
          workerId: i + 1,
          status: 'idle',
          currentTestName: null,
        })),
      });
    } catch (err) {
      console.error('Failed to start execution:', err);
    }
  };

  const handleStopExecution = async () => {
    // TODO: Implement stop execution
    setExecutionState(prev => ({ ...prev, isExecuting: false }));
  };

  const handleViewRun = (runId: string) => {
    navigate(`/test-monitor/run/${runId}`);
  };

  const handleSelectTestCase = (id: string) => {
    dispatch(selectTestCase(id));
    setActiveTab('persona');
  };

  const handleToggleSelection = (id: string) => dispatch(toggleTestCaseSelection(id));

  const handleCancelSelection = () => {
    dispatch(selectTestCase(null));
    dispatch(cancelEditing());
  };

  const handleEdit = () => {
    if (selectedTestCase) {
      dispatch(startEditing(selectedTestCase));
    }
  };

  const handleRunSelectedTest = async () => {
    if (!selectedTestCase) return;
    try {
      const result = await dispatch(runGoalTests({
        caseIds: [selectedTestCase.caseId],
        config: { concurrency: 1 },
      })).unwrap();

      setExecutionState({
        isExecuting: true,
        runId: result.runId,
        progress: { total: 1, completed: 0, passed: 0, failed: 0, skipped: 0 },
        workers: [{ workerId: 1, status: 'idle', currentTestName: null }],
      });
    } catch (err) {
      console.error('Failed to run test:', err);
    }
  };

  const handleSaveTestCase = async () => {
    if (!editingTestCase) return;
    try {
      if (isCreating) {
        await dispatch(createGoalTestCase(editingTestCase)).unwrap();
      } else {
        await dispatch(updateGoalTestCase({
          caseId: editingTestCase.caseId,
          updates: editingTestCase,
        })).unwrap();
      }
      dispatch(cancelEditing());
    } catch (err) {
      console.error('Failed to save test case:', err);
    }
  };

  const handlePersonaChange = (persona: UserPersonaDTO) => {
    if (editingTestCase) dispatch(startEditing({ ...editingTestCase, persona }));
  };

  const handleGoalsChange = (goals: GoalTestCaseRecord['goals']) => {
    if (editingTestCase) dispatch(startEditing({ ...editingTestCase, goals }));
  };

  const handleConstraintsChange = (responseConfig: ResponseConfigDTO) => {
    if (editingTestCase) dispatch(startEditing({ ...editingTestCase, responseConfig }));
  };

  // Progress percentage
  const progressPercentage = executionState.progress.total > 0
    ? Math.round((executionState.progress.completed / executionState.progress.total) * 100)
    : 0;

  return (
    <div className="h-full flex flex-col p-6">
      <PageHeader
        title="Goal Tests"
        subtitle="Configure and execute goal-based test cases for the Flowise agent"
      />

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 mt-6">
        {/* Left Column - Test Categories & Config */}
        <div className="col-span-5 flex flex-col gap-6 overflow-hidden">
          {/* Search */}
          <Card>
            <div className="p-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Icons.Search />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tests..."
                  className={clsx(
                    'block w-full pl-10 pr-4 py-2 text-sm rounded-lg',
                    'border border-gray-200 dark:border-gray-600',
                    'bg-gray-50 dark:bg-gray-900',
                    'text-gray-900 dark:text-gray-100',
                    'placeholder-gray-400',
                    'focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  )}
                />
              </div>
            </div>
          </Card>

          {/* Test Categories */}
          <Card className="flex-1 overflow-hidden">
            <div className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Test Categories
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredTestCases.length} tests
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
                  </div>
                ) : error ? (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                ) : (
                  CATEGORIES.map((category) => (
                    <CategorySection
                      key={category}
                      category={category}
                      testCases={testCasesByCategory[category] || []}
                      isCollapsed={collapsedCategories.includes(category)}
                      selectedIds={selectedTestCaseIds}
                      activeId={selectedTestCaseId}
                      runningCaseIds={runningCaseIds}
                      onToggleCollapse={() => dispatch(toggleCategoryCollapse(category))}
                      onSelectTestCase={handleSelectTestCase}
                      onToggleSelection={handleToggleSelection}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>

          {/* Execution Config */}
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Execution Config
              </h3>
              <div className="space-y-4">
                {/* Concurrency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Concurrency (parallel workers)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={concurrency}
                      onChange={(e) => setConcurrency(parseInt(e.target.value))}
                      className="flex-1"
                      disabled={executionState.isExecuting}
                    />
                    <span className="w-8 text-center font-medium text-gray-900 dark:text-white">
                      {concurrency}
                    </span>
                  </div>
                  {concurrency > 3 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      High concurrency may trigger API rate limits
                    </p>
                  )}
                </div>

                {/* Run Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Run Count (times to run each test)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={runCount}
                      onChange={(e) => setRunCount(parseInt(e.target.value))}
                      className="flex-1"
                      disabled={executionState.isExecuting}
                    />
                    <span className="w-8 text-center font-medium text-gray-900 dark:text-white">
                      {runCount}
                    </span>
                  </div>
                  {runCount > 1 && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Each test will run {runCount} times
                    </p>
                  )}
                </div>

                {/* Timeout */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Timeout (seconds)
                  </label>
                  <select
                    value={testTimeout}
                    onChange={(e) => setTestTimeout(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    disabled={executionState.isExecuting}
                  >
                    <option value={30000}>30 seconds</option>
                    <option value={60000}>60 seconds</option>
                    <option value={120000}>120 seconds</option>
                    <option value={180000}>180 seconds</option>
                  </select>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={retryFailed}
                      onChange={(e) => setRetryFailed(e.target.checked)}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      disabled={executionState.isExecuting}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Retry failed tests</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enableSemanticEval}
                      onChange={(e) => setEnableSemanticEval(e.target.checked)}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      disabled={executionState.isExecuting}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Enable semantic evaluation</span>
                  </label>
                </div>
              </div>

              {/* Start/Stop Button */}
              <div className="mt-6">
                {executionState.isExecuting ? (
                  <Button
                    onClick={handleStopExecution}
                    variant="danger"
                    className="w-full"
                  >
                    Stop Execution
                  </Button>
                ) : (
                  (() => {
                    const testCount = selectedTestCount > 0 ? selectedTestCount : filteredTestCases.length;
                    const totalRuns = testCount * runCount;
                    return (
                      <Button
                        onClick={handleStartExecution}
                        variant="primary"
                        className="w-full"
                        disabled={filteredTestCases.length === 0}
                      >
                        Start Test Run ({testCount} tests{runCount > 1 ? ` × ${runCount} = ${totalRuns} runs` : ''})
                      </Button>
                    );
                  })()
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Status/Recent OR Test Details */}
        <div className="col-span-7 flex flex-col gap-6">
          {selectedTestCase ? (
            /* Test Details Panel (when test selected) */
            <Card className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={clsx(
                        'px-2.5 py-1 text-xs font-mono font-bold rounded',
                        CATEGORY_CONFIG[activeTestCase?.category as TestCategory]?.colors.badge
                      )}>
                        {activeTestCase?.caseId}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {activeTestCase?.name || 'Untitled Test'}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Icons.User />
                        {activeTestCase?.persona?.name || 'No persona'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icons.Target />
                        {activeTestCase?.goals?.length || 0} goals
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingTestCase ? (
                      <>
                        <Button
                          onClick={handleCancelSelection}
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveTestCase}
                          variant="primary"
                        >
                          {isCreating ? 'Create Test' : 'Save Changes'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={handleCancelSelection}
                          variant="secondary"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleEdit}
                          variant="secondary"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={handleRunSelectedTest}
                          variant="primary"
                          disabled={running}
                        >
                          {runningCaseIds.includes(activeTestCase?.caseId || '') ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Icons.Play />
                              <span className="ml-1.5">Run</span>
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex-shrink-0 flex gap-1 px-6 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {(['persona', 'goals', 'config'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                      activeTab === tab
                        ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    )}
                  >
                    {tab === 'persona' && 'Persona'}
                    {tab === 'goals' && 'Goals'}
                    {tab === 'config' && 'Response Config'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
                {activeTab === 'persona' && activeTestCase && (
                  <PersonaEditor
                    persona={activeTestCase.persona}
                    onChange={handlePersonaChange}
                    readOnly={!editingTestCase}
                  />
                )}
                {activeTab === 'goals' && activeTestCase && (
                  <GoalsEditor
                    goals={activeTestCase.goals}
                    onChange={handleGoalsChange}
                    readOnly={!editingTestCase}
                  />
                )}
                {activeTab === 'config' && activeTestCase && (
                  <ResponseConfigEditor
                    responseConfig={activeTestCase.responseConfig}
                    onChange={handleConstraintsChange}
                    readOnly={!editingTestCase}
                  />
                )}
              </div>
            </Card>
          ) : (
            /* Execution Status + Recent Runs (when no test selected) */
            <>
              {/* Execution Status */}
              <Card>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Execution Status
                  </h3>

                  {executionState.isExecuting ? (
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Progress
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {executionState.progress.completed}/{executionState.progress.total} ({progressPercentage}%)
                          </span>
                        </div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Status Summary */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{executionState.progress.total}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{executionState.progress.passed}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Passed</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{executionState.progress.failed}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{executionState.progress.skipped}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Skipped</div>
                        </div>
                      </div>

                      {/* Workers */}
                      {executionState.workers.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Workers</h4>
                          <div className="space-y-2">
                            {executionState.workers.map((worker) => (
                              <div
                                key={worker.workerId}
                                className={`flex items-center gap-3 p-2 rounded transition-all ${
                                  worker.status === 'running'
                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                    : 'bg-gray-50 dark:bg-gray-800'
                                }`}
                              >
                                {worker.status === 'running' ? (
                                  <svg className="w-5 h-5 text-green-500 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : worker.status === 'completed' ? (
                                  <Icons.CheckCircle />
                                ) : worker.status === 'error' ? (
                                  <Icons.XCircle />
                                ) : (
                                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                                <span className={`text-sm font-medium ${
                                  worker.status === 'running'
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  Worker {worker.workerId}
                                </span>
                                <span className={`text-sm truncate flex-1 ${
                                  worker.status === 'running'
                                    ? 'text-green-600 dark:text-green-400 font-medium'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {worker.currentTestName || 'Idle'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Icons.Monitor />
                      <p className="mt-2">No test run in progress</p>
                      <p className="text-sm">Select categories and start a test run</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Recent Runs */}
              <Card className="flex-1 min-h-0">
                <div className="p-4 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Recent Runs
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/test-monitor/history')}
                    >
                      View All
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {recentRuns.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No test runs yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recentRuns.slice(0, 5).map((run) => {
                          const passRate = run.totalTests > 0
                            ? Math.round((run.passed / run.totalTests) * 100)
                            : 0;
                          const startedAt = new Date(run.startedAt).toLocaleString();

                          return (
                            <button
                              key={run.runId}
                              onClick={() => handleViewRun(run.runId)}
                              className="w-full flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                passRate === 100 ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                passRate >= 70 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {passRate}%
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white truncate">
                                    {run.runId.slice(0, 8)}...
                                  </span>
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    run.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    run.status === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                    run.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                  }`}>
                                    {run.status}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {run.totalTests} tests | {startedAt}
                                </div>
                              </div>
                              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
