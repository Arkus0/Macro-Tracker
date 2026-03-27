import 'package:drift/drift.dart';
import '../../../database/database.dart';
import '../../domain/models/nutrition_log.dart';
import '../../domain/repositories/nutrition_repository.dart';

class NutritionRepositoryImpl implements NutritionRepository {
  final AppDatabase _db;

  NutritionRepositoryImpl(this._db);

  @override
  Future<List<NutritionLog>> getLogs({DateTime? start, DateTime? end}) async {
    final query = _db.select(_db.dailyLogs);

    if (start != null && end != null) {
      query.where((t) => t.date.isBetweenValues(start, end));
    }

    query.orderBy([(t) => OrderingTerm(expression: t.date)]);

    final rows = await query.get();

    return rows.map((row) {
      return NutritionLog(
        date: row.date,
        weight: row.weight,
        calories: row.calories?.toDouble(),
        protein: row.protein?.toDouble(),
      );
    }).toList();
  }

  @override
  Future<void> saveLog(NutritionLog log) async {
    final companion = DailyLogsCompanion(
      date: Value(log.date),
      weight: Value(log.weight),
      calories: Value(log.calories?.toInt()),
      protein: Value(log.protein?.toInt()),
    );

    await _db.into(_db.dailyLogs).insertOnConflictUpdate(companion);
  }

  @override
  Future<void> deleteLog(DateTime date) async {
    await (_db.delete(_db.dailyLogs)..where((t) => t.date.equals(date))).go();
  }
}
