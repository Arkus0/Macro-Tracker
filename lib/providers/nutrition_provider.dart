import 'package:riverpod/riverpod.dart';
import 'package:drift/drift.dart';
import '../database/database.dart';
import '../repositories/nutrition_repository.dart';
import '../services/nutrition_engine.dart';

// Placeholder for the repository provider.
// The main app should override this provider with the actual repository instance.
final nutritionRepositoryProvider = Provider<NutritionRepository>((ref) {
  throw UnimplementedError('Provider not implemented. Override in main.dart');
});

class NutritionState {
  final double currentTDEE;
  final double weeklyWeightTrend;
  final DailyLog? todayLog;

  const NutritionState({
    required this.currentTDEE,
    required this.weeklyWeightTrend,
    this.todayLog,
  });

  NutritionState copyWith({
    double? currentTDEE,
    double? weeklyWeightTrend,
    DailyLog? todayLog,
  }) {
    return NutritionState(
      currentTDEE: currentTDEE ?? this.currentTDEE,
      weeklyWeightTrend: weeklyWeightTrend ?? this.weeklyWeightTrend,
      todayLog: todayLog ?? this.todayLog,
    );
  }
}

final nutritionProvider = AsyncNotifierProvider<NutritionNotifier, NutritionState>(NutritionNotifier.new);

class NutritionNotifier extends AsyncNotifier<NutritionState> {
  @override
  Future<NutritionState> build() async {
    final repository = ref.watch(nutritionRepositoryProvider);

    // Fetch logs from a generous history window to ensure trend calculation is accurate.
    // Fetching from year 2000 covers all practical history for this app.
    final logs = await repository.getLogs(
      DateTime(2000),
      DateTime.now().add(const Duration(days: 1))
    );

    final engine = NutritionEngine();
    final tdee = engine.calculateDynamicTDEE(logs);
    final trend = engine.calculateLatestTrend(logs) ?? 0.0;

    // Find today's log
    DailyLog? todayLog;
    if (logs.isNotEmpty) {
      final now = DateTime.now();
      try {
        todayLog = logs.firstWhere((l) =>
          l.date.year == now.year &&
          l.date.month == now.month &&
          l.date.day == now.day
        );
      } catch (_) {
        todayLog = null;
      }
    }

    return NutritionState(
      currentTDEE: tdee,
      weeklyWeightTrend: trend,
      todayLog: todayLog,
    );
  }

  /// Updates today's log with new values.
  Future<void> updateTodayLog({double? weight, int? calories, int? protein}) async {
    final repository = ref.read(nutritionRepositoryProvider);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    final companion = DailyLogsCompanion(
      date: Value(today),
      weight: weight != null ? Value(weight) : const Value.absent(),
      calories: calories != null ? Value(calories) : const Value.absent(),
      protein: protein != null ? Value(protein) : const Value.absent(),
    );

    await repository.upsertLog(companion);

    // Refresh the state to reflect changes and recalculate TDEE
    ref.invalidateSelf();
  }
}
