import '../database/database.dart';

class NutritionEngine {
  static const int _analysisWindowDays = 28;
  static const double _caloriesPerKg = 7700.0;

  /// Calculates the Dynamic TDEE based on weight trends and calorie consumption.
  ///
  /// [logs]: List of DailyLog entries.
  /// [defaultTDEE]: Fallback TDEE if insufficient data is available.
  ///
  /// Returns the calculated TDEE or [defaultTDEE].
  double calculateDynamicTDEE(List<DailyLog> logs, {double defaultTDEE = 2000.0}) {
    if (logs.isEmpty) return defaultTDEE;

    // 1. Sort logs by date ascending
    final sortedLogs = List<DailyLog>.from(logs)..sort((a, b) => a.date.compareTo(b.date));

    // 2. Calculate Rolling Trends
    final trendMap = _calculateTrends(sortedLogs);

    // 3. Define Analysis Window (Last 28 days from the last log)
    final lastLog = sortedLogs.last;
    final analysisStartDate = lastLog.date.subtract(const Duration(days: _analysisWindowDays - 1));

    // Filter logs within this window
    final windowLogs = sortedLogs.where((l) =>
      !l.date.isBefore(analysisStartDate) && !l.date.isAfter(lastLog.date)
    ).toList();

    if (windowLogs.isEmpty) return defaultTDEE;

    // 4. Calculate Average Calories in Window
    final validCalorieLogs = windowLogs.where((l) => l.calories != null && l.calories! > 0).toList();
    if (validCalorieLogs.isEmpty) {
      // If we don't have calorie data, we can't calculate TDEE
      return defaultTDEE;
    }

    final double avgKcal = validCalorieLogs
        .map((l) => l.calories!)
        .reduce((a, b) => a + b) / validCalorieLogs.length;

    // 5. Calculate Weight Delta using Trends
    // Use the first and last log available in the window
    final startLog = windowLogs.first;
    final endLog = windowLogs.last;

    final startTrend = trendMap[startLog.date];
    final endTrend = trendMap[endLog.date];

    // If trends are missing (e.g., no weights at all in the window/history), return default
    if (startTrend == null || endTrend == null) {
      return defaultTDEE;
    }

    final int daysDiff = endLog.date.difference(startLog.date).inDays;

    // Requirement: Handle edge cases (less than 7 days of data)
    if (daysDiff < 7) {
      return defaultTDEE;
    }

    // 6. Apply Formula
    // TDEE = AvgKcal - ((EndTrend - StartTrend) * 7700 / Days)
    final double weightChange = endTrend - startTrend;
    final double estimatedSurplus = (weightChange * _caloriesPerKg) / daysDiff;

    return avgKcal - estimatedSurplus;
  }

  /// Calculates the latest 7-day rolling average weight trend.
  double? calculateLatestTrend(List<DailyLog> logs) {
    if (logs.isEmpty) return null;
    final sortedLogs = List<DailyLog>.from(logs)..sort((a, b) => a.date.compareTo(b.date));
    final trendMap = _calculateTrends(sortedLogs);
    return trendMap[sortedLogs.last.date];
  }

  /// Helper to calculate the 7-day rolling average (trend) for each log.
  Map<DateTime, double> _calculateTrends(List<DailyLog> sortedLogs) {
    final Map<DateTime, double> trendMap = {};

    for (int i = 0; i < sortedLogs.length; i++) {
      final currentLog = sortedLogs[i];
      final windowStart = currentLog.date.subtract(const Duration(days: 6));

      double sumWeights = 0;
      int countWeights = 0;

      // Look back in the sorted list to find logs within the 7-day window
      for (int j = i; j >= 0; j--) {
        final prevLog = sortedLogs[j];
        if (prevLog.date.isBefore(windowStart)) break;

        if (prevLog.weight != null) {
          sumWeights += prevLog.weight!;
          countWeights++;
        }
      }

      if (countWeights > 0) {
        trendMap[currentLog.date] = sumWeights / countWeights;
      }
    }
    return trendMap;
  }
}
