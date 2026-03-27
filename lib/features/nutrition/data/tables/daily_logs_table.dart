import 'package:drift/drift.dart';

class DailyLogs extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get date => dateTime().unique()();
  RealColumn get weight => real().nullable()();
  IntColumn get calories => integer().nullable()();
  // Keeping protein for future proofing/compatibility
  IntColumn get protein => integer().nullable()();
}
