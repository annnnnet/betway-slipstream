/// Dart mirrors of the `@slipstream/shared` zod contracts.
///
/// Hand-ported rather than generated. The contract is small and stable, and a
/// codegen step (build_runner, json_serializable) would add more setup to the
/// Flutter build than it saves on four classes. If the API surface grows this
/// is the first thing that should become generated.
library;

class Odds {
  const Odds({required this.decimal, required this.numerator, required this.denominator});

  final double decimal;
  final int numerator;
  final int denominator;

  factory Odds.fromJson(Map<String, dynamic> json) => Odds(
        decimal: (json['decimal'] as num).toDouble(),
        numerator: json['numerator'] as int,
        denominator: json['denominator'] as int,
      );

  String get display => decimal.toStringAsFixed(2);
  String get fraction => '$numerator/$denominator';
}

class SlipEvent {
  const SlipEvent({
    required this.name,
    required this.league,
    required this.startsAt,
    required this.isLive,
  });

  final String name;
  final String? league;
  final DateTime? startsAt;
  final bool isLive;

  factory SlipEvent.fromJson(Map<String, dynamic> json) => SlipEvent(
        name: json['name'] as String? ?? 'Unknown event',
        league: json['league'] as String?,
        // The API always sends ISO-8601 or null, but a malformed value here
        // would crash the whole slip rather than one row, so parse leniently.
        startsAt: DateTime.tryParse(json['startsAt'] as String? ?? ''),
        isLive: json['isLive'] as bool? ?? false,
      );
}

class Selection {
  const Selection({
    required this.outcomeId,
    required this.outcomeName,
    required this.marketName,
    required this.odds,
    required this.event,
    required this.isLive,
  });

  final String outcomeId;
  final String outcomeName;
  final String marketName;
  final Odds odds;
  final SlipEvent event;

  /// True only when Betway reports the outcome, its market and its event all
  /// active — the same rule the web client uses to grey a leg out.
  final bool isLive;

  factory Selection.fromJson(Map<String, dynamic> json) => Selection(
        outcomeId: json['outcomeId'] as String,
        outcomeName: json['outcomeName'] as String? ?? 'Unknown selection',
        marketName: json['marketName'] as String? ?? 'Unknown market',
        odds: Odds.fromJson(json['odds'] as Map<String, dynamic>),
        event: SlipEvent.fromJson(json['event'] as Map<String, dynamic>),
        isLive: (json['isOutcomeActive'] as bool? ?? true) &&
            (json['isMarketActive'] as bool? ?? true) &&
            (json['isEventActive'] as bool? ?? true),
      );
}

class Slip {
  const Slip({
    required this.code,
    required this.selections,
    required this.combinedOdds,
    required this.isSingleBet,
    required this.betwayUrl,
  });

  final String code;
  final List<Selection> selections;
  final double combinedOdds;
  final bool isSingleBet;
  final String betwayUrl;

  factory Slip.fromJson(Map<String, dynamic> json) => Slip(
        code: json['code'] as String,
        selections: (json['selections'] as List<dynamic>)
            .map((s) => Selection.fromJson(s as Map<String, dynamic>))
            .toList(),
        combinedOdds: (json['combinedOdds'] as num).toDouble(),
        isSingleBet: json['isSingleBet'] as bool? ?? false,
        betwayUrl: json['betwayUrl'] as String,
      );
}

/// The API's error envelope. Carrying `code` (not just the message) is what
/// lets the UI tell a mistyped code apart from a Betway outage.
class ApiException implements Exception {
  const ApiException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => message;
}
