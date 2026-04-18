import { useState } from 'react';
import { ArrowLeft, Target, Lock, FlaskConical } from 'lucide-react';
import {
  buildCounterfactualSummary,
  type CounterfactualDisplayCombination,
  type CounterfactualResponsePayload,
  coerceInputDataForPrediction,
  getTopPredictionConfidence,
  mapCounterfactualsToDisplayCombinations,
  mapShapTopFeatures,
  requestCounterfactuals,
  requestPredictionWithShap,
} from '../services/predictionFlow';

// --- Types --------------------------------------------------------------------

export interface FeatureMeta {
  name: string;
  type: string;
  possibleValues?: string[];
}

export interface CounterfactualConfig {
  targetCondition: {
    feature: string;
    op: string;       // '=', '<', '>', '<=', '>='
    value: string;
  };
  instanceValues: Record<string, string>;
}

// Payload returned to Dashboard so it can build run history without owning API logic.
export interface PredictionSubmissionPayload {
  predictionInput: Record<string, string | number>;
  predictionResult: {
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
  } | null;
  predictionError: string | null;
  shapTopFeatures: Array<{ name: string; importance: number }>;
  topConfidence: number | null;
  counterfactualResult: CounterfactualResponsePayload | null;
  counterfactualError: string | null;
  counterfactualCombinations: CounterfactualDisplayCombination[];
  counterfactualSummary: string;
}

interface CounterfactualConfigFormProps {
  datasetName: string;
  targetFeature: string;
  frozenFeatures: string[];
  modelId: number | null;
  featureMetas: FeatureMeta[];   // all columns with type metadata
  onBack: () => void;
  onPredictionRequestStateChange?: (isRunning: boolean) => void;
  onSubmit: (
    config: CounterfactualConfig,
    prediction: PredictionSubmissionPayload
  ) => Promise<void> | void;
}

// --- Numeric operator button group --------------------------------------------

const NUMERIC_OPS = ['=', '<', '>', '<=', '>='] as const;
type NumericOp = typeof NUMERIC_OPS[number];

function OpSelector({ value, onChange }: { value: NumericOp; onChange: (op: NumericOp) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10 shrink-0">
      {NUMERIC_OPS.map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onChange(op)}
          className={`
            px-3 py-2.5 text-sm font-mono font-bold min-w-[38px] transition-all duration-150 border-r border-white/10 last:border-r-0
            ${value === op
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}
          `}
        >
          {op}
        </button>
      ))}
    </div>
  );
}

// --- Main component -----------------------------------------------------------

export function CounterfactualConfigForm({
  datasetName,
  targetFeature,
  frozenFeatures,
  modelId,
  featureMetas,
  onBack,
  onPredictionRequestStateChange,
  onSubmit,
}: CounterfactualConfigFormProps) {
  const targetMeta = featureMetas.find((f) => f.name === targetFeature)!;
  const isNumericTarget = targetMeta?.type === 'integer' || targetMeta?.type === 'float';

  // -- Outcome condition state --
  const [op, setOp] = useState<NumericOp>('=');
  const [targetValue, setTargetValue] = useState('');

  // -- Instance values state (all features except target) --
  const instanceFeatures = featureMetas.filter((f) => f.name !== targetFeature);
  const [instanceValues, setInstanceValues] = useState<Record<string, string>>(
    Object.fromEntries(instanceFeatures.map((f) => [f.name, '']))
  );

  // upload status
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (name: string, val: string) =>
    setInstanceValues((prev) => ({ ...prev, [name]: val }));

  // CSV upload handler
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };

    reader.readAsText(file);
  };

  // CSV parser
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');

    if (lines.length < 2) {
      setUploadStatus('CSV must contain header + one data row');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const values = lines[1].split(',').map((v) => v.trim());

    if (headers.length !== values.length) {
      setUploadStatus('Header and data length mismatch');
      return;
    }

    const newValues: Record<string, string> = {};

    headers.forEach((header, i) => {
      newValues[header] = values[i];
    });

    const filteredValues = Object.fromEntries(
      Object.entries(newValues).filter(([key]) =>
        instanceFeatures.some((f) => f.name === key)
      )
    );

    setInstanceValues((prev) => ({
      ...prev,
      ...filteredValues,
    }));

    // OPTIONAL: auto-fill target if present
    if (headers.includes(targetFeature)) {
      setTargetValue(newValues[targetFeature]);
    }

    setUploadStatus('CSV loaded successfully');
  };

  // -- Validation --
  const conditionValid = targetValue.trim() !== '';
  const allFilled = instanceFeatures.every((f) => instanceValues[f.name]?.trim() !== '');
  const canSubmit = conditionValid && allFilled;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (modelId === null) {
      alert('Model training is not completed yet. Please wait for training to finish before running prediction and SHAP.');
      return;
    }

    try {
      setIsSubmitting(true);
      onPredictionRequestStateChange?.(true);

      // Step 1: Coerce string inputs to backend-friendly numeric types when applicable.
      const predictionInput = coerceInputDataForPrediction(
        instanceValues,
        featureMetas.map((meta) => ({
          name: meta.name,
          dataType: meta.type,
        }))
      );

      // Step 2: Request prediction + SHAP from backend.
      const { predictionResult, predictionError } = await requestPredictionWithShap(
        modelId,
        predictionInput
      );

      const predictionProbabilities =
        predictionResult?.prediction_probabilities &&
        typeof predictionResult.prediction_probabilities === 'object'
          ? Object.fromEntries(
              Object.entries(predictionResult.prediction_probabilities).filter(
                ([, value]) => typeof value === 'number' && Number.isFinite(value)
              )
            )
          : null;

      const shapTopFeatures = mapShapTopFeatures(predictionResult?.shap_explanation || null);
      const topConfidence = getTopPredictionConfidence(predictionProbabilities);

      let counterfactualResult: CounterfactualResponsePayload | null = null;
      let counterfactualError: string | null = null;

      if (typeof predictionResult?.prediction_id === 'number') {
        const counterfactualResponse = await requestCounterfactuals(
          predictionResult.prediction_id,
          targetValue,
          frozenFeatures
        );

        counterfactualResult = counterfactualResponse.counterfactualResult;
        counterfactualError = counterfactualResponse.counterfactualError;
      } else if (!predictionError) {
        counterfactualError = 'Counterfactual request skipped because prediction id is unavailable.';
      }

      const counterfactualCombinations = mapCounterfactualsToDisplayCombinations(counterfactualResult);
      const counterfactualSummary = buildCounterfactualSummary(counterfactualResult, counterfactualError);

      // Step 3: Pass both counterfactual config and prediction payload back to parent state.
      await onSubmit({
        targetCondition: { feature: targetFeature, op, value: targetValue },
        instanceValues,
      }, {
        predictionInput,
        predictionResult:
          predictionResult && predictionProbabilities
            ? {
                ...predictionResult,
                prediction_probabilities: predictionProbabilities,
              }
            : predictionResult,
        predictionError,
        shapTopFeatures,
        topConfidence,
        counterfactualResult,
        counterfactualError,
        counterfactualCombinations,
        counterfactualSummary,
      });

      if (predictionError) {
        alert(`Prediction request failed. The run was saved with error details.\n\n${predictionError}`);
      } else if (counterfactualError) {
        alert(`Counterfactual generation failed. The run was saved with error details.\n\n${counterfactualError}`);
      }
    } finally {
      onPredictionRequestStateChange?.(false);
      setIsSubmitting(false);
    }
  };

  // -- Helpers --
  const isFrozen = (name: string) => frozenFeatures.includes(name);

  const renderInstanceInput = (meta: FeatureMeta) => {
    const baseClass =
      'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white ' +
      'placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 transition-all';

    if (meta.type === 'categorical' && meta.possibleValues?.length) {
      return (
        <select
          value={instanceValues[meta.name]}
          onChange={(e) => setField(meta.name, e.target.value)}
          className={`${baseClass} appearance-none cursor-pointer bg-[#0d0d0d]`}
        >
          <option value="" disabled className="text-white/25">
            Select a value...
          </option>
          {meta.possibleValues.map((val) => (
            <option key={val} value={val} className="text-white bg-[#0d0d0d]">
              {val}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="number"
        step={meta.type === 'float' ? 'any' : '1'}
        value={instanceValues[meta.name]}
        onChange={(e) => setField(meta.name, e.target.value)}
        placeholder="Enter value..."
        className={baseClass}
      />
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8 space-y-10">

        {/* -- Page header -- */}
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            className="mt-1 p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/30 mb-1">{datasetName}</p>
            <h1 className="text-2xl font-semibold text-white">Configure Counterfactual Query</h1>
            <p className="text-sm text-white/50 mt-1">
              Define the outcome you want to flip, then provide the instance values to explain.
            </p>
          </div>
        </div>

        {/* -- Section 1: Target outcome condition -- */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/15">
              <Target className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Desired Outcome Condition</h2>
              <p className="text-xs text-white/45">
                Specify what value <span className="text-white/70 font-mono">{targetFeature}</span> should flip to.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            {/* Feature badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm font-mono font-medium text-amber-300">{targetFeature}</span>
              <span className="text-xs text-white/30 border-l border-white/15 pl-2 ml-0.5">{targetMeta?.type}</span>
            </div>

            {targetMeta?.type === 'categorical' && targetMeta.possibleValues?.length ? (
              <div className="flex items-center gap-3">
                <div className="shrink-0 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-mono font-bold text-white/35">
                  =
                </div>
                <select
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="
                    flex-1 bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-2.5
                    text-white font-mono text-sm appearance-none cursor-pointer
                    focus:outline-none focus:border-blue-500/60 transition-all
                  "
                >
                  <option value="" disabled className="text-white/25">
                    Select target value...
                  </option>
                  {targetMeta.possibleValues.map((val) => (
                    <option key={val} value={val} className="text-white bg-[#0d0d0d]">
                      {val}
                    </option>
                  ))}
                </select>
              </div>
            ) : isNumericTarget ? (
              <div className="flex items-center gap-3">
                <OpSelector value={op} onChange={setOp} />
                <input
                  type="number"
                  step={targetMeta?.type === 'float' ? 'any' : '1'}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="Enter target value..."
                  className="
                    flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5
                    text-white placeholder:text-white/25 font-mono text-sm
                    focus:outline-none focus:border-blue-500/60 transition-all
                  "
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="shrink-0 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-mono font-bold text-white/35">
                  =
                </div>
                <input
                  type="text"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="Enter target value..."
                  className="
                    flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5
                    text-white placeholder:text-white/25 font-mono text-sm
                    focus:outline-none focus:border-blue-500/60 transition-all
                  "
                />
              </div>
            )}

            {/* Live preview */}
            {targetValue && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-white/35">Condition preview:</span>
                <code className="text-xs bg-white/8 border border-white/10 rounded px-2 py-1 text-emerald-300 font-mono">
                  {targetFeature} {isNumericTarget ? op : '='} {targetValue}
                </code>
              </div>
            )}
          </div>
        </section>

        {/* -- Section 2: Instance feature values -- */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/15">
              <FlaskConical className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Instance Feature Values</h2>
              <p className="text-xs text-white/45">
                Enter the current values of each feature for the instance you want to explain.
              </p>
            </div>
          </div>

          {/* CSV upload UI */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 text-sm text-white/70">
              Upload CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                disabled={isSubmitting}
                className="hidden"
              />
            </label>

            {uploadStatus && (
              <span className="text-xs text-white/40">{uploadStatus}</span>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1.6fr] gap-4 px-5 py-3 border-b border-white/10 bg-white/[0.03]">
              <span className="text-xs font-medium uppercase tracking-widest text-white/35">Feature</span>
              <span className="text-xs font-medium uppercase tracking-widest text-white/35">Value</span>
            </div>

            {/* Feature rows */}
            <div className="divide-y divide-white/[0.06]">
              {instanceFeatures.map((meta) => {
                const frozen = isFrozen(meta.name);
                return (
                  <div
                    key={meta.name}
                    className={`grid grid-cols-[1fr_1.6fr] gap-4 px-5 py-3.5 items-center transition-colors ${
                      frozen ? 'bg-blue-900/10' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Feature label */}
                    <div className="flex items-center gap-2 min-w-0">
                      {frozen && (
                        <span title="Frozen - value won't change during generation">
                        <Lock className="w-3.5 h-3.5 text-blue-400/70 shrink-0" />
                        </span>
                      )}
                      <span className="text-sm font-mono truncate text-white/80">
                        {meta.name}
                      </span>
                      <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded border font-mono ${
                        frozen
                          ? 'text-blue-400/60 border-blue-400/20 bg-blue-400/5'
                          : 'text-white/25 border-white/10 bg-white/5'
                      }`}>
                        {meta.type}
                      </span>
                    </div>

                    {/* Input */}
                    <div>{renderInstanceInput(meta)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* -- Submit bar -- */}
        <div className="sticky bottom-0 -mx-8 px-8 pb-8 pt-4 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur">
            <div className="text-sm text-white/40 space-y-0.5">
              {!conditionValid && (
                <p className="text-amber-400/70"> Set a target outcome condition above.</p>
              )}
              {conditionValid && !allFilled && (
                <p className="text-amber-400/70"> Fill in all instance feature values.</p>
              )}
              {canSubmit && (
                <p className="text-emerald-400/80"> Ready to generate counterfactuals.</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="
                shrink-0 px-6 py-2.5 rounded-lg font-medium text-sm transition-all
                bg-blue-600 hover:bg-blue-500 text-white
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600
              "
            >
              {isSubmitting ? 'Generating...' : 'Generate Counterfactuals'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

