class NutritionLog {
  final DateTime date;
  final double? weight;
  final double? calories;
  final double? protein;

  NutritionLog({
    required this.date,
    this.weight,
    this.calories,
    this.protein,
  });

  NutritionLog copyWith({
    DateTime? date,
    double? weight,
    double? calories,
    double? protein,
  }) {
    return NutritionLog(
      date: date ?? this.date,
      weight: weight ?? this.weight,
      calories: calories ?? this.calories,
      protein: protein ?? this.protein,
    );
  }
}
