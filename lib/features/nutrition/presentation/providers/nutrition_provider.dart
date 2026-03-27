import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../database/database.dart';
import '../../data/repositories/nutrition_repository_impl.dart';
import '../../domain/logic/tdee_calculator.dart';
import '../../domain/models/nutrition_log.dart';
import '../../domain/models/nutrition_stats.dart';
import '../../domain/repositories/nutrition_repository.dart';

/// Provider for the AppDatabase.
/// This must be overridden in the main app to provide the actual database instance.
final nutritionDatabaseProvider = Provider<AppDatabase>((ref) {
  throw UnimplementedError('nutritionDatabaseProvider must be overridden or implemented.');
});

/// Provider for the Nutrition Repository.
final nutritionRepositoryProvider = Provider<NutritionRepository>((ref) {
  final db = ref.watch(nutritionDatabaseProvider);
  return NutritionRepositoryImpl(db);
});

/// Provider for the TDEE Calculator logic.
final tdeeCalculatorProvider = Provider<TdeeCalculator>((ref) {
  return TdeeCalculator();
});

/// The main controller for the Nutrition Feature.
/// Manages state (NutritionStats) and actions (logging).
final nutritionProvider = AsyncNotifierProvider<NutritionController, NutritionStats>(() {
  return NutritionController();
});

class NutritionController extends AsyncNotifier<NutritionStats> {

  @override
  Future<NutritionStats> build() async {
    return _fetchStats();
  }

  Future<NutritionStats> _fetchStats() async {
    final repository = ref.read(nutritionRepositoryProvider);
    final calculator = ref.read(tdeeCalculatorProvider);

    // Fetch all logs to ensure trend calculation is accurate over time.
    // In a production app with huge data, we might limit this to the last year.
    final logs = await repository.getLogs();

    return calculator.calculateStats(logs);
  }

  /// Adds or updates a daily log.
  Future<void> logEntry(NutritionLog log) async {
    final repository = ref.read(nutritionRepositoryProvider);

    // Set state to loading while saving
    state = const AsyncValue.loading();

    state = await AsyncValue.guard(() async {
      await repository.saveLog(log);
      return _fetchStats();
    });
  }

  /// Deletes a log for a specific date.
  Future<void> deleteEntry(DateTime date) async {
    final repository = ref.read(nutritionRepositoryProvider);

    state = const AsyncValue.loading();

    state = await AsyncValue.guard(() async {
      await repository.deleteLog(date);
      return _fetchStats();
    });
  }
}
