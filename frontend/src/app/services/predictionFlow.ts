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
