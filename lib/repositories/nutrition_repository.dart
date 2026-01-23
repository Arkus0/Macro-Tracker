import 'package:drift/drift.dart';
import '../database/database.dart';

class NutritionRepository {
  final AppDatabase _db;

  NutritionRepository(this._db);

  /// Retrieves logs within the specified date range, ordered by date.
  Future<List<DailyLog>> getLogs(DateTime start, DateTime end) {
    return (_db.select(_db.dailyLogs)
          ..where((t) => t.date.isBetweenValues(start, end))
          ..orderBy([(t) => OrderingTerm(expression: t.date)]))
        .get();
  }

  /// Inserts or updates a daily log.
  Future<int> upsertLog(DailyLogsCompanion log) {
    return _db.into(_db.dailyLogs).insertOnConflictUpdate(log);
  }
}
