import 'package:drift/drift.dart';

class DailyLogs extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get date => dateTime().unique()();
  RealColumn get weight => real().nullable()();
  IntColumn get calories => integer().nullable()();
  IntColumn get protein => integer().nullable()();
}
