// Centralized helpers for the Phase 4 prediction + SHAP frontend flow.
export interface PredictResponsePayload {
  prediction_id?: number;
  prediction_value?: number;
  prediction_class?: string;
  prediction_probabilities?: Record<string, number> | null;
  shap_explanation?: {
    feature_importance?: Array<{
      feature?: string;
      abs_shap_value?: number;
    }>;
    base_value?: number;
  } | null;
}

export interface PredictionFeatureMeta {
  name: string;
  dataType: string;
}

export interface PredictionRequestResult {
  predictionResult: PredictResponsePayload | null;
  predictionError: string | null;
}

export interface CounterfactualOptionPayload {
  counterfactual_data?: Record<string, unknown>;
  counterfactual_class?: string;
  confidence?: number;
  feature_changes?: Record<
    string,
    {
      original?: unknown;
      counterfactual?: unknown;
      change?: unknown;
      percent_change?: unknown;
    }
  >;
  num_changes?: number;
  changed_features?: string[];
  combined_score?: number;
}

export interface CounterfactualResponsePayload {
  status?: string;
  total_generated?: number;
  unique_feature_combinations?: number;
  grouped_counterfactuals?: Record<string, CounterfactualOptionPayload[]>;
}

export interface CounterfactualRequestResult {
  counterfactualResult: CounterfactualResponsePayload | null;
  counterfactualError: string | null;
}

export interface CounterfactualDisplayCombination {
  id: number;
  confidence?: number | null;
  combinedScore?: number | null;
  features: { name: string; value: string }[];
}

// Convert string form inputs into numeric values when metadata marks the feature as numeric.
export const coerceInputDataForPrediction = (
  rawInput: Record<string, string>,
  featureMetas: PredictionFeatureMeta[]
): Record<string, string | number> => {
  const typeByFeature = new Map(featureMetas.map((meta) => [meta.name, meta.dataType.toLowerCase()]));

  return Object.fromEntries(
    Object.entries(rawInput).map(([featureName, value]) => {
      const type = typeByFeature.get(featureName) || '';

      if (type.includes('categorical') || type.includes('category') || type.includes('object') || type.includes('string')) {
        return [featureName, value];
      }

      if (type.includes('int')) {
        const parsed = Number.parseInt(value, 10);
        return [featureName, Number.isNaN(parsed) ? value : parsed];
      }

      if (
        type.includes('float') ||
        type.includes('double') ||
        type.includes('decimal') ||
        type.includes('number') ||
        type.includes('continuous')
      ) {
        const parsed = Number.parseFloat(value);
        return [featureName, Number.isNaN(parsed) ? value : parsed];
      }

      return [featureName, value];
    })
  );
};

// Normalize backend SHAP feature importance into a 0-1 range for progress-bar rendering.
export const mapShapTopFeatures = (
  shapExplanation: PredictResponsePayload['shap_explanation']
): Array<{ name: string; importance: number }> => {
  const ranked = Array.isArray(shapExplanation?.feature_importance)
    ? shapExplanation.feature_importance
        .filter(
          (item): item is { feature: string; abs_shap_value: number } =>
            typeof item?.feature === 'string' &&
            typeof item?.abs_shap_value === 'number' &&
            Number.isFinite(item.abs_shap_value)
        )
        .slice(0, 5)
    : [];

  if (ranked.length === 0) return [];

  const maxAbs = Math.max(...ranked.map((item) => item.abs_shap_value), 0);

  return ranked.map((item) => ({
    name: item.feature,
    importance: maxAbs > 0 ? item.abs_shap_value / maxAbs : 0,
  }));
};

// Pick the highest probability from prediction probabilities for summary display.
export const getTopPredictionConfidence = (probabilities: Record<string, number> | null): number | null => {
  if (!probabilities) return null;

  const values = Object.values(probabilities).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );

  if (values.length === 0) return null;
  return Math.max(...values);
};

// Execute prediction endpoint call and return a consistent success/error object.
export const requestPredictionWithShap = async (
  modelId: number,
  inputData: Record<string, string | number>
): Promise<PredictionRequestResult> => {
  try {
    const response = await fetch('http://localhost:8000/api/v1/predictions/predict/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: modelId,
        input_data: inputData,
        generate_shap: true,
      }),
    });

    let responseData: any = {};
    try {
      responseData = await response.json();
    } catch {
      responseData = {};
    }

    if (!response.ok) {
      const message =
        responseData?.error ||
        responseData?.detail ||
        (typeof responseData === 'string' ? responseData : 'Prediction request failed.');

      return {
        predictionResult: null,
        predictionError: message,
      };
    }

    return {
      predictionResult: responseData,
      predictionError: null,
    };
  } catch (error) {
    return {
      predictionResult: null,
      predictionError: error instanceof Error ? error.message : 'Unknown prediction error.',
    };
  }
};

// Execute DiCE counterfactual generation for a stored prediction id.
export const requestCounterfactuals = async (
  predictionId: number,
  desiredClass: string | null,
  frozenFeatures: string[]
): Promise<CounterfactualRequestResult> => {
  const requestBody: Record<string, unknown> = {
    prediction_id: predictionId,
    max_iterations: 1000,
  };

  if (desiredClass && desiredClass.trim().length > 0) {
    requestBody.desired_class = desiredClass;
  }

  if (frozenFeatures.length > 0) {
    requestBody.feature_constraints = {
      frozen_features: frozenFeatures,
    };
  }

  try {
    const response = await fetch(
      `http://localhost:8000/api/v1/predictions/${predictionId}/find_counterfactuals/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    let responseData: any = {};
    try {
      responseData = await response.json();
    } catch {
      responseData = {};
    }

    if (!response.ok) {
      const message =
        responseData?.error ||
        responseData?.detail ||
        responseData?.status ||
        (typeof responseData === 'string' ? responseData : 'Counterfactual request failed.');

      return {
        counterfactualResult: null,
        counterfactualError: message,
      };
    }

    return {
      counterfactualResult: responseData,
      counterfactualError: null,
    };
  } catch (error) {
    return {
      counterfactualResult: null,
      counterfactualError: error instanceof Error ? error.message : 'Unknown counterfactual error.',
    };
  }
};

const toDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const mapOptionToFeatures = (option: CounterfactualOptionPayload): { name: string; value: string }[] => {
  const featureChanges = option.feature_changes;

  if (featureChanges && typeof featureChanges === 'object') {
    const changeRows = Object.entries(featureChanges).map(([featureName, details]) => {
      const original = toDisplayValue(details?.original);
      const counterfactual = toDisplayValue(details?.counterfactual);
      return {
        name: featureName,
        value: `${original} -> ${counterfactual}`,
      };
    });

    if (changeRows.length > 0) return changeRows;
  }

  if (option.counterfactual_data && typeof option.counterfactual_data === 'object') {
    return Object.entries(option.counterfactual_data)
      .slice(0, 4)
      .map(([featureName, value]) => ({
        name: featureName,
        value: toDisplayValue(value),
      }));
  }

  return [];
};

// Flatten grouped counterfactual options into top-ranked cards for the current UI.
export const mapCounterfactualsToDisplayCombinations = (
  counterfactualResult: CounterfactualResponsePayload | null,
  maxItems = 6
): CounterfactualDisplayCombination[] => {
  const grouped = counterfactualResult?.grouped_counterfactuals;
  if (!grouped || typeof grouped !== 'object') return [];

  const options = Object.values(grouped)
    .filter((group): group is CounterfactualOptionPayload[] => Array.isArray(group))
    .flat();

  const ranked = options
    .map((option) => ({
      confidence:
        typeof option.confidence === 'number' && Number.isFinite(option.confidence)
          ? option.confidence
          : null,
      combinedScore:
        typeof option.combined_score === 'number' && Number.isFinite(option.combined_score)
          ? option.combined_score
          : null,
      features: mapOptionToFeatures(option),
    }))
    .filter((option) => option.features.length > 0)
    .sort((left, right) => {
      const leftScore = left.combinedScore ?? -1;
      const rightScore = right.combinedScore ?? -1;
      if (leftScore !== rightScore) return rightScore - leftScore;

      const leftConfidence = left.confidence ?? -1;
      const rightConfidence = right.confidence ?? -1;
      return rightConfidence - leftConfidence;
    })
    .slice(0, maxItems)
    .map((option, index) => ({
      id: index + 1,
      confidence: option.confidence,
      combinedScore: option.combinedScore,
      features: option.features,
    }));

  return ranked;
};

// Build user-facing summary text for DiCE output area.
export const buildCounterfactualSummary = (
  counterfactualResult: CounterfactualResponsePayload | null,
  counterfactualError: string | null
): string => {
  if (counterfactualError) {
    return `Counterfactual generation failed: ${counterfactualError}`;
  }

  if (!counterfactualResult) {
    return 'Counterfactual generation did not return a response.';
  }

  const totalGenerated =
    typeof counterfactualResult.total_generated === 'number'
      ? counterfactualResult.total_generated
      : null;
  const uniqueCombinations =
    typeof counterfactualResult.unique_feature_combinations === 'number'
      ? counterfactualResult.unique_feature_combinations
      : null;

  if (totalGenerated !== null && uniqueCombinations !== null) {
    return `Generated ${totalGenerated} counterfactual candidates across ${uniqueCombinations} feature-combination groups.`;
  }

  return 'Counterfactual generation completed.';
};
