/**
 * Create Goal Test Slice
 * State management for the Goal Test Creation Wizard
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type {
  CreateGoalTestState,
  WizardStep,
  WizardFormData,
  BasicInfoFormData,
  WizardSource,
  AISuggestionRequest,
  AISuggestionResponse,
  GoalTestTemplate,
  GoalAnalysisResult,
  GoalAnalysisState,
} from '../../types/goalTestWizard.types';
import {
  DEFAULT_FORM_DATA,
  DEFAULT_VALIDATION,
  DEFAULT_RESPONSE_CONFIG,
  DEFAULT_PERSONA,
  DEFAULT_BASIC_INFO,
  DEFAULT_AI_ANALYZER_STATE,
  WizardStep as WizardStepEnum,
} from '../../types/goalTestWizard.types';
import type {
  UserPersonaDTO,
  DynamicUserPersonaDTO,
  ConversationGoalDTO,
  TestConstraintDTO,
  ResponseConfigDTO,
  GoalTestCaseRecord,
} from '../../types/testMonitor.types';
import * as testMonitorApi from '../../services/api/testMonitorApi';
import {
  validateBasicInfo,
  validatePersona,
  validateGoals,
  validateResponseConfig,
  getCaseIdPrefix,
} from '../../utils/goalTestValidation';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: CreateGoalTestState = {
  currentStep: WizardStepEnum.Analyzer,
  isComplete: false,
  formData: { ...DEFAULT_FORM_DATA },
  validation: { ...DEFAULT_VALIDATION },
  source: {
    type: 'blank',
    id: null,
    name: null,
  },
  generatedCaseId: null,
  draftId: null,
  isDirty: false,
  lastSavedAt: null,
  aiSuggestions: {
    loading: false,
    suggestions: null,
    error: null,
    lastRequestedAt: null,
  },
  aiAnalyzer: { ...DEFAULT_AI_ANALYZER_STATE },
  originalGoalDescription: null,
  isLoading: false,
  isSaving: false,
  isSubmitting: false,
  error: null,
  submitError: null,
};

// ============================================================================
// ASYNC THUNKS
// ============================================================================

/**
 * Submit the wizard form and create the goal test
 */
export const submitGoalTest = createAsyncThunk(
  'createGoalTest/submit',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const { formData, generatedCaseId } = state.createGoalTest;

    try {
      const testCaseData = {
        caseId: generatedCaseId || '',
        name: formData.basicInfo.name,
        description: formData.basicInfo.description,
        category: formData.basicInfo.category,
        tags: formData.basicInfo.tags,
        persona: formData.persona,
        goals: formData.goals,
        constraints: formData.constraints,
        responseConfig: formData.responseConfig,
        initialMessage: formData.basicInfo.initialMessage,
      };

      const result = await testMonitorApi.createGoalTestCase(testCaseData);
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to create goal test'
      );
    }
  }
);

/**
 * Clone an existing goal test case as the starting point
 */
export const cloneFromTestCase = createAsyncThunk(
  'createGoalTest/cloneFrom',
  async (caseId: string, { rejectWithValue }) => {
    try {
      const sourceTest = await testMonitorApi.getGoalTestCase(caseId);
      return sourceTest;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch test case for cloning'
      );
    }
  }
);

/**
 * Generate the next available case ID
 */
export const generateCaseId = createAsyncThunk(
  'createGoalTest/generateCaseId',
  async (category: string, { rejectWithValue }) => {
    try {
      const response = await testMonitorApi.getGoalTestCases({ category });
      const existingIds = response.testCases.map((tc) => tc.caseId);

      // Find the next available number
      const prefix = getCaseIdPrefix(category as any);
      let nextNum = 1;

      existingIds.forEach((id) => {
        const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= nextNum) {
            nextNum = num + 1;
          }
        }
      });

      return `${prefix}-${nextNum.toString().padStart(3, '0')}`;
    } catch (error) {
      // Generate a fallback ID if API fails
      const prefix = getCaseIdPrefix(category as any);
      return `${prefix}-${Date.now().toString().slice(-3)}`;
    }
  }
);

/**
 * Request AI suggestions for goals and constraints
 */
export const requestAISuggestions = createAsyncThunk(
  'createGoalTest/requestAISuggestions',
  async (request: AISuggestionRequest, { rejectWithValue }) => {
    try {
      const response = await testMonitorApi.generateAISuggestions(request);
      return response;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to get AI suggestions'
      );
    }
  }
);

/**
 * Analyze a natural language goal description (Step 0 - AI Analyzer)
 */
export const analyzeGoalDescription = createAsyncThunk(
  'createGoalTest/analyzeGoalDescription',
  async (
    request: { description: string; model?: 'fast' | 'standard' | 'detailed' },
    { rejectWithValue }
  ) => {
    try {
      const response = await testMonitorApi.analyzeGoalDescription(request);
      return response;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to analyze goal description'
      );
    }
  }
);

/**
 * Save wizard draft to local storage
 */
export const saveDraft = createAsyncThunk(
  'createGoalTest/saveDraft',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const { formData, currentStep, source, draftId } = state.createGoalTest;

    const draft = {
      id: draftId || `draft-${Date.now()}`,
      formData,
      currentStep,
      source,
      savedAt: new Date().toISOString(),
    };

    // Save to local storage
    localStorage.setItem('goalTestWizardDraft', JSON.stringify(draft));

    return draft;
  }
);

/**
 * Load wizard draft from local storage
 */
export const loadDraft = createAsyncThunk(
  'createGoalTest/loadDraft',
  async (_, { rejectWithValue }) => {
    try {
      const savedDraft = localStorage.getItem('goalTestWizardDraft');
      if (!savedDraft) {
        return rejectWithValue('No draft found');
      }
      return JSON.parse(savedDraft);
    } catch (error) {
      return rejectWithValue('Failed to load draft');
    }
  }
);

// ============================================================================
// SLICE
// ============================================================================

const createGoalTestSlice = createSlice({
  name: 'createGoalTest',
  initialState,
  reducers: {
    // Navigation
    setStep: (state, action: PayloadAction<WizardStep>) => {
      state.currentStep = action.payload;
    },
    nextStep: (state) => {
      if (state.currentStep < WizardStepEnum.Review) {
        state.currentStep += 1;
      }
    },
    prevStep: (state) => {
      if (state.currentStep > WizardStepEnum.Analyzer) {
        state.currentStep -= 1;
      }
    },

    // AI Analyzer (Step 0)
    setAnalyzerDescription: (state, action: PayloadAction<string>) => {
      state.aiAnalyzer.description = action.payload;
    },

    applyAnalysisResult: (state, action: PayloadAction<GoalAnalysisResult>) => {
      const result = action.payload;
      if (result.success && result.wizardData) {
        // Apply the wizard data from AI analysis
        state.formData = result.wizardData;
        state.source = {
          type: 'ai-analyzed',
          id: null,
          name: result.analysis.detectedIntent,
        };
        state.aiAnalyzer.result = result;
        state.isDirty = true;

        // Store the original goal description for use by AI Helper in later steps
        // This ensures the AI Helper generates suggestions aligned with the original intent
        state.originalGoalDescription = state.aiAnalyzer.description;

        // Validate all steps with the new data
        const basicValidation = validateBasicInfo(state.formData.basicInfo);
        const personaValidation = validatePersona(state.formData.persona);
        const goalsValidation = validateGoals(state.formData.goals, state.formData.constraints);
        const configValidation = validateResponseConfig(state.formData.responseConfig);

        state.validation[WizardStepEnum.BasicInfo] = { ...basicValidation, touched: true };
        state.validation[WizardStepEnum.Persona] = { ...personaValidation, touched: true };
        state.validation[WizardStepEnum.Goals] = { ...goalsValidation, touched: true };
        state.validation[WizardStepEnum.Config] = { ...configValidation, touched: true };
      }
    },

    clearAnalyzer: (state) => {
      state.aiAnalyzer = { ...DEFAULT_AI_ANALYZER_STATE };
    },

    // Basic Info
    updateBasicInfo: (state, action: PayloadAction<Partial<BasicInfoFormData>>) => {
      state.formData.basicInfo = { ...state.formData.basicInfo, ...action.payload };
      state.isDirty = true;

      // Revalidate
      const validation = validateBasicInfo(state.formData.basicInfo);
      state.validation[WizardStepEnum.BasicInfo] = { ...validation, touched: true };
    },

    // Persona
    updatePersona: (state, action: PayloadAction<UserPersonaDTO | DynamicUserPersonaDTO>) => {
      state.formData.persona = action.payload;
      state.isDirty = true;

      // Revalidate
      const validation = validatePersona(action.payload);
      state.validation[WizardStepEnum.Persona] = { ...validation, touched: true };
    },

    // Goals
    updateGoals: (state, action: PayloadAction<ConversationGoalDTO[]>) => {
      state.formData.goals = action.payload;
      state.isDirty = true;

      // Revalidate
      const validation = validateGoals(action.payload, state.formData.constraints);
      state.validation[WizardStepEnum.Goals] = { ...validation, touched: true };
    },

    addGoal: (state, action: PayloadAction<ConversationGoalDTO>) => {
      state.formData.goals.push(action.payload);
      state.isDirty = true;

      const validation = validateGoals(state.formData.goals, state.formData.constraints);
      state.validation[WizardStepEnum.Goals] = { ...validation, touched: true };
    },

    removeGoal: (state, action: PayloadAction<string>) => {
      state.formData.goals = state.formData.goals.filter((g) => g.id !== action.payload);
      state.isDirty = true;

      const validation = validateGoals(state.formData.goals, state.formData.constraints);
      state.validation[WizardStepEnum.Goals] = { ...validation, touched: true };
    },

    // Constraints
    updateConstraints: (state, action: PayloadAction<TestConstraintDTO[]>) => {
      state.formData.constraints = action.payload;
      state.isDirty = true;

      const validation = validateGoals(state.formData.goals, action.payload);
      state.validation[WizardStepEnum.Goals] = { ...validation, touched: true };
    },

    addConstraint: (state, action: PayloadAction<TestConstraintDTO>) => {
      state.formData.constraints.push(action.payload);
      state.isDirty = true;
    },

    removeConstraint: (state, action: PayloadAction<number>) => {
      state.formData.constraints.splice(action.payload, 1);
      state.isDirty = true;
    },

    // Response Config
    updateResponseConfig: (state, action: PayloadAction<Partial<ResponseConfigDTO>>) => {
      state.formData.responseConfig = { ...state.formData.responseConfig, ...action.payload };
      state.isDirty = true;

      const validation = validateResponseConfig(state.formData.responseConfig);
      state.validation[WizardStepEnum.Config] = { ...validation, touched: true };
    },

    // Templates
    applyTemplate: (state, action: PayloadAction<GoalTestTemplate>) => {
      const template = action.payload;

      state.formData.basicInfo.category = template.category;
      state.formData.basicInfo.tags = [...template.tags];
      state.formData.basicInfo.initialMessage = template.defaults.initialMessage;

      if (template.defaults.persona) {
        state.formData.persona = {
          ...DEFAULT_PERSONA,
          ...template.defaults.persona,
        } as DynamicUserPersonaDTO;
      }

      state.formData.goals = [...template.defaults.goals];
      state.formData.constraints = [...template.defaults.constraints];
      state.formData.responseConfig = { ...template.defaults.responseConfig };

      state.source = {
        type: 'template',
        id: template.id,
        name: template.name,
      };

      state.isDirty = true;

      // Revalidate all steps
      state.validation[WizardStepEnum.Persona] = { ...validatePersona(state.formData.persona), touched: true };
      state.validation[WizardStepEnum.Goals] = { ...validateGoals(state.formData.goals, state.formData.constraints), touched: true };
      state.validation[WizardStepEnum.Config] = { ...validateResponseConfig(state.formData.responseConfig), touched: true };
    },

    // AI Suggestions
    applyAISuggestion: (
      state,
      action: PayloadAction<{ type: 'goals' | 'constraints'; index: number }>
    ) => {
      const { type, index } = action.payload;
      if (!state.aiSuggestions.suggestions) return;

      if (type === 'goals' && state.aiSuggestions.suggestions.goals[index]) {
        const suggestion = state.aiSuggestions.suggestions.goals[index];
        state.formData.goals.push(suggestion.data);
        suggestion.accepted = true;
      } else if (type === 'constraints' && state.aiSuggestions.suggestions.constraints[index]) {
        const suggestion = state.aiSuggestions.suggestions.constraints[index];
        state.formData.constraints.push(suggestion.data);
        suggestion.accepted = true;
      }

      state.isDirty = true;
    },

    applyAllAISuggestions: (state) => {
      if (!state.aiSuggestions.suggestions) return;

      state.aiSuggestions.suggestions.goals.forEach((suggestion) => {
        if (!suggestion.accepted) {
          state.formData.goals.push(suggestion.data);
          suggestion.accepted = true;
        }
      });

      state.aiSuggestions.suggestions.constraints.forEach((suggestion) => {
        if (!suggestion.accepted) {
          state.formData.constraints.push(suggestion.data);
          suggestion.accepted = true;
        }
      });

      if (state.aiSuggestions.suggestions.initialMessage) {
        state.formData.basicInfo.initialMessage =
          state.aiSuggestions.suggestions.initialMessage.message;
      }

      state.isDirty = true;

      const validation = validateGoals(state.formData.goals, state.formData.constraints);
      state.validation[WizardStepEnum.Goals] = { ...validation, touched: true };
    },

    clearAISuggestions: (state) => {
      state.aiSuggestions = {
        loading: false,
        suggestions: null,
        error: null,
        lastRequestedAt: null,
      };
    },

    // Reset
    resetWizard: (state) => {
      return { ...initialState };
    },

    // Clear draft
    clearDraft: (state) => {
      localStorage.removeItem('goalTestWizardDraft');
      state.draftId = null;
      state.lastSavedAt = null;
    },

    // Error handling
    clearError: (state) => {
      state.error = null;
      state.submitError = null;
    },

    // Set generated case ID
    setCaseId: (state, action: PayloadAction<string>) => {
      state.generatedCaseId = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Submit
    builder
      .addCase(submitGoalTest.pending, (state) => {
        state.isSubmitting = true;
        state.submitError = null;
      })
      .addCase(submitGoalTest.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.isComplete = true;
        // Clear draft after successful submit
        localStorage.removeItem('goalTestWizardDraft');
      })
      .addCase(submitGoalTest.rejected, (state, action) => {
        state.isSubmitting = false;
        state.submitError = action.payload as string;
      });

    // Clone from test case
    builder
      .addCase(cloneFromTestCase.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cloneFromTestCase.fulfilled, (state, action) => {
        state.isLoading = false;
        const sourceTest = action.payload;

        // Populate form data from source
        state.formData = {
          basicInfo: {
            name: `${sourceTest.name} (Copy)`,
            description: sourceTest.description,
            category: sourceTest.category,
            tags: [...sourceTest.tags],
            initialMessage: sourceTest.initialMessage,
          },
          persona: { ...sourceTest.persona },
          goals: sourceTest.goals.map((g) => ({ ...g, id: `${g.id}-copy` })),
          constraints: [...sourceTest.constraints],
          responseConfig: { ...sourceTest.responseConfig },
        };

        state.source = {
          type: 'clone',
          id: sourceTest.caseId,
          name: sourceTest.name,
        };

        state.isDirty = true;

        // Validate all steps
        state.validation[WizardStepEnum.BasicInfo] = { ...validateBasicInfo(state.formData.basicInfo), touched: true };
        state.validation[WizardStepEnum.Persona] = { ...validatePersona(state.formData.persona), touched: true };
        state.validation[WizardStepEnum.Goals] = { ...validateGoals(state.formData.goals, state.formData.constraints), touched: true };
        state.validation[WizardStepEnum.Config] = { ...validateResponseConfig(state.formData.responseConfig), touched: true };
      })
      .addCase(cloneFromTestCase.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Generate case ID
    builder
      .addCase(generateCaseId.fulfilled, (state, action) => {
        state.generatedCaseId = action.payload;
      });

    // AI Suggestions
    builder
      .addCase(requestAISuggestions.pending, (state) => {
        state.aiSuggestions.loading = true;
        state.aiSuggestions.error = null;
        state.aiSuggestions.lastRequestedAt = new Date().toISOString();
      })
      .addCase(requestAISuggestions.fulfilled, (state, action) => {
        state.aiSuggestions.loading = false;
        if (action.payload.success) {
          state.aiSuggestions.suggestions = action.payload.suggestions;
        } else {
          state.aiSuggestions.error = action.payload.error || 'Failed to get suggestions';
        }
      })
      .addCase(requestAISuggestions.rejected, (state, action) => {
        state.aiSuggestions.loading = false;
        state.aiSuggestions.error = action.payload as string;
      });

    // Save draft
    builder.addCase(saveDraft.fulfilled, (state, action) => {
      state.draftId = action.payload.id;
      state.lastSavedAt = action.payload.savedAt;
      state.isDirty = false;
    });

    // Load draft
    builder
      .addCase(loadDraft.fulfilled, (state, action) => {
        const draft = action.payload;
        state.formData = draft.formData;
        state.currentStep = draft.currentStep;
        state.source = draft.source;
        state.draftId = draft.id;
        state.lastSavedAt = draft.savedAt;
        state.isDirty = false;

        // Revalidate all steps
        state.validation[WizardStepEnum.BasicInfo] = { ...validateBasicInfo(state.formData.basicInfo), touched: true };
        state.validation[WizardStepEnum.Persona] = { ...validatePersona(state.formData.persona), touched: true };
        state.validation[WizardStepEnum.Goals] = { ...validateGoals(state.formData.goals, state.formData.constraints), touched: true };
        state.validation[WizardStepEnum.Config] = { ...validateResponseConfig(state.formData.responseConfig), touched: true };
      });

    // AI Goal Analysis (Step 0)
    builder
      .addCase(analyzeGoalDescription.pending, (state) => {
        state.aiAnalyzer.loading = true;
        state.aiAnalyzer.error = null;
      })
      .addCase(analyzeGoalDescription.fulfilled, (state, action) => {
        state.aiAnalyzer.loading = false;
        state.aiAnalyzer.lastAnalyzedAt = new Date().toISOString();
        if (action.payload.success) {
          state.aiAnalyzer.result = action.payload;
        } else {
          state.aiAnalyzer.error = action.payload.error || 'Analysis failed';
        }
      })
      .addCase(analyzeGoalDescription.rejected, (state, action) => {
        state.aiAnalyzer.loading = false;
        state.aiAnalyzer.error = action.payload as string;
      });
  },
});

// ============================================================================
// SELECTORS
// ============================================================================

export const selectCreateGoalTestState = (state: RootState) => state.createGoalTest;

export const selectCurrentStep = (state: RootState) => state.createGoalTest.currentStep;

export const selectFormData = (state: RootState) => state.createGoalTest.formData;

export const selectValidation = (state: RootState) => state.createGoalTest.validation;

export const selectCanProceed = (state: RootState) => {
  const { currentStep, validation } = state.createGoalTest;
  return validation[currentStep as WizardStep]?.isValid ?? false;
};

export const selectIsFormValid = (state: RootState) => {
  const { validation } = state.createGoalTest;
  return (
    validation[WizardStepEnum.BasicInfo].isValid &&
    validation[WizardStepEnum.Persona].isValid &&
    validation[WizardStepEnum.Goals].isValid &&
    validation[WizardStepEnum.Config].isValid
  );
};

export const selectSource = (state: RootState) => state.createGoalTest.source;

export const selectAISuggestions = (state: RootState) => state.createGoalTest.aiSuggestions;

export const selectAIAnalyzer = (state: RootState) => state.createGoalTest.aiAnalyzer;

export const selectOriginalGoalDescription = (state: RootState) => state.createGoalTest.originalGoalDescription;

export const selectIsDirty = (state: RootState) => state.createGoalTest.isDirty;

export const selectIsSubmitting = (state: RootState) => state.createGoalTest.isSubmitting;

export const selectSubmitError = (state: RootState) => state.createGoalTest.submitError;

// ============================================================================
// EXPORTS
// ============================================================================

export const {
  setStep,
  nextStep,
  prevStep,
  setAnalyzerDescription,
  applyAnalysisResult,
  clearAnalyzer,
  updateBasicInfo,
  updatePersona,
  updateGoals,
  addGoal,
  removeGoal,
  updateConstraints,
  addConstraint,
  removeConstraint,
  updateResponseConfig,
  applyTemplate,
  applyAISuggestion,
  applyAllAISuggestions,
  clearAISuggestions,
  resetWizard,
  clearDraft,
  clearError,
  setCaseId,
} = createGoalTestSlice.actions;

export default createGoalTestSlice.reducer;
