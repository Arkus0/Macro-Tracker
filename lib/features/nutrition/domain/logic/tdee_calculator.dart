import '../models/nutrition_log.dart';
import '../models/nutrition_stats.dart';

class TdeeCalculator {
  static const int _trendWindowDays = 7;
  static const int _analysisWindowDays = 28;
  static const double _kcalPerKgFat = 7700;

  NutritionStats calculateStats(List<NutritionLog> logs) {
    if (logs.isEmpty) {
      return NutritionStats.empty();
    }

    // Sort logs by date
    logs.sort((a, b) => a.date.compareTo(b.date));

    // 1. Calculate Trend Series (using only logs with weight)
    final trends = _calculateTrendSeries(logs);

    // 2. Current Trend
    // We need the trend for the *latest log date*, or the latest available trend?
    // User wants "Tendencia". Usually today's trend.
    // If today has no log, maybe yesterday's?
    // We'll take the trend of the last log in the list (even if it has no weight, we might have calculated a trend for it based on history? No, _calculateTrendSeries only adds entries for logs.
    // Actually, we should calculate trend for every log date.

    double currentTrend = 0.0;
    if (trends.isNotEmpty) {
      // Find the trend for the latest log, or the latest available trend key.
      final latestDate = logs.last.date;
      if (trends.containsKey(latestDate)) {
        currentTrend = trends[latestDate]!;
      } else if (trends.isNotEmpty) {
        // Fallback to the most recent calculated trend
        final sortedTrendDates = trends.keys.toList()..sort();
        currentTrend = trends[sortedTrendDates.last]!;
      }
    }

    double tdee = 0.0;
    double weekAvgKcal = 0.0;

    // 3. TDEE Calculation
    if (logs.isNotEmpty) {
        final latestLog = logs.last;
        final windowStartDate = latestLog.date.subtract(const Duration(days: _analysisWindowDays - 1));

        // Filter for analysis window
        final windowLogs = logs.where((l) =>
            !l.date.isBefore(windowStartDate) && !l.date.isAfter(latestLog.date)
        ).toList();

        if (windowLogs.isNotEmpty) {
            // Average Kcal: Consider only logs with calories
            final kcalLogs = windowLogs.where((l) => l.calories != null).toList();
            double avgKcal = 0.0;
            if (kcalLogs.isNotEmpty) {
                final totalKcal = kcalLogs.fold(0.0, (s, l) => s + l.calories!);
                avgKcal = totalKcal / kcalLogs.length;
            }

            // Delta Weight
            // Start of window (or first available log in window)
            // End of window (or last available log in window)
            final firstLog = windowLogs.first;
            final lastLog = windowLogs.last;

            // Get trends for these dates. If missing, we can't calculate delta reliably?
            // Or fallback to raw weight? Or nearest trend?
            // We'll try to get trend. If not, fallback to weight. If that's null, skip?
            // If we can't get Delta, TDEE = AvgKcal (assuming Maintenance).

            final valFinal = trends[lastLog.date] ?? lastLog.weight;
            final valInitial = trends[firstLog.date] ?? firstLog.weight;

            if (valFinal != null && valInitial != null) {
                 final deltaWeight = valFinal - valInitial;

                 final daysDiff = lastLog.date.difference(firstLog.date).inDays;
                 final days = daysDiff == 0 ? 1 : daysDiff;

                 final realCaloricBalance = (deltaWeight * _kcalPerKgFat) / days;
                 tdee = avgKcal - realCaloricBalance;
            } else {
                 // Fallback if no weight data to calculate delta
                 tdee = avgKcal;
            }

            // Week Average
            final weekStart = latestLog.date.subtract(const Duration(days: 6));
            final weekLogs = logs.where((l) =>
                !l.date.isBefore(weekStart) &&
                !l.date.isAfter(latestLog.date) &&
                l.calories != null
            ).toList();

            if (weekLogs.isNotEmpty) {
                weekAvgKcal = weekLogs.fold(0.0, (s, l) => s + l.calories!) / weekLogs.length;
            }
        }
    }

    // Today's log
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    NutritionLog? todaysLog;
    try {
      todaysLog = logs.firstWhere(
        (l) =>
          l.date.year == today.year &&
          l.date.month == today.month &&
          l.date.day == today.day
      );
    } catch (_) {
      todaysLog = null;
    }

    return NutritionStats(
      tdee: tdee,
      trendWeight: currentTrend,
      todaysLog: todaysLog,
      weekAverageKcal: weekAvgKcal,
    );
  }

  Map<DateTime, double> _calculateTrendSeries(List<NutritionLog> logs) {
    final trends = <DateTime, double>{};

    for (var i = 0; i < logs.length; i++) {
        final currentLog = logs[i];
        // Even if currentLog has no weight, we might calculate trend if previous days have weight?
        // But the trend is "for this day".
        // If currentLog weight is null, can we say the trend exists?
        // Typically, we only plot trend points where we have data or interpolated.
        // We will calculate trend for every log entry based on available history.

        final windowStart = currentLog.date.subtract(const Duration(days: _trendWindowDays - 1));

        double sum = 0;
        int count = 0;

        // Look back
        for (var j = i; j >= 0; j--) {
            final prevLog = logs[j];
            if (prevLog.date.isBefore(windowStart)) break;

            if (prevLog.weight != null) {
                sum += prevLog.weight!;
                count++;
            }
        }

        if (count > 0) { // min_periods=1
            trends[currentLog.date] = sum / count;
        }
    }
    return trends;
  }
}
