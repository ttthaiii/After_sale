// Single source of truth for the customer CSAT average.
// History.tsx and HistoryDetailModal.tsx used to read wo.overallSatisfaction /
// task.satisfaction — fields that are never written anywhere (the real data
// lives in wo.satisfactionSurvey, saved by submitCustomerInspection /
// submitPhCustomerInspection). That left them always falling through to a
// hardcoded '5.0' string regardless of what the customer actually scored.

type SatisfactionSurvey = {
    workQuality: number;
    siteCleanliness: number;
    foremanProfessionalism: number;
    specAccuracy: number;
    handoverCare: number;
} | null | undefined;

/** Average of the 5 CSAT criteria, formatted to 1 decimal. Null when no survey exists. */
export const getSatisfactionAverage = (survey: SatisfactionSurvey): string | null => {
    if (!survey) return null;
    const scores = [
        survey.workQuality,
        survey.siteCleanliness,
        survey.foremanProfessionalism,
        survey.specAccuracy,
        survey.handoverCare
    ].filter((n): n is number => typeof n === 'number');
    if (scores.length === 0) return null;
    const avg = scores.reduce((sum, n) => sum + n, 0) / scores.length;
    return avg.toFixed(1);
};
