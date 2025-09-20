export async function analyzeMerged(userId: string, mergedPayload: any) {
  const lastHbA1c = mergedPayload?.payload?.last_hba1c || mergedPayload?.last_hba1c || null;
  const bmi = mergedPayload?.payload?.bmi || mergedPayload?.bmi || null;

  const predictions = [];
  if (lastHbA1c && Number(lastHbA1c) >= 6.5) {
    predictions.push({
      condition: 'Type 2 Diabetes',
      years: 2,
      probability: Math.min(95, Math.round((Number(lastHbA1c) - 4) * 12)),
      preventable: true,
      interventions: ['Reduce refined carbs','15–30 min walk after meals']
    });
  }
  if (bmi && Number(bmi) >= 28) {
    predictions.push({
      condition: 'Cardiovascular Disease',
      years: 5,
      probability: Math.min(80, Math.round((Number(bmi) - 20) * 3)),
      preventable: true,
      interventions: ['150 min/wk moderate exercise','Strength training 2x/week']
    });
  }
  if (!predictions.length) {
    predictions.push({
      condition: 'Overall Risk (general)',
      years: 5,
      probability: 12,
      preventable: true,
      interventions: ['Maintain healthy diet','Daily walk']
    });
  }

  return {
    model_version: 'toy-v1',
    generated_on: new Date().toISOString(),
    predictions,
    explainability: {
      top_features: [
        { feature: 'hbA1c', impact: lastHbA1c ? Number(lastHbA1c) : 0 },
        { feature: 'bmi', impact: bmi ? Number(bmi) : 0 }
      ]
    }
  };
}
