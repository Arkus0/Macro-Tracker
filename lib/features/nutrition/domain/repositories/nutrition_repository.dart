import '../models/nutrition_log.dart';

abstract class NutritionRepository {
  /// Retrieves logs within the specified date range.
  Future<List<NutritionLog>> getLogs({DateTime? start, DateTime? end});

  /// Saves (inserts or updates) a daily log.
  Future<void> saveLog(NutritionLog log);

  /// Deletes a log for a specific date.
  Future<void> deleteLog(DateTime date);
}
