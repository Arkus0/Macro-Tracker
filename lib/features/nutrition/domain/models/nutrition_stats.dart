import 'nutrition_log.dart';

class NutritionStats {
  final double tdee;
  final double trendWeight;
  final NutritionLog? todaysLog;
  final double weekAverageKcal;

  NutritionStats({
    required this.tdee,
    required this.trendWeight,
    this.todaysLog,
    required this.weekAverageKcal,
  });

  factory NutritionStats.empty() {
    return NutritionStats(
      tdee: 0,
      trendWeight: 0,
      weekAverageKcal: 0,
    );
  }
}
