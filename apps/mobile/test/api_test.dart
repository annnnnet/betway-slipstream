import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:slipstream/api.dart';
import 'package:slipstream/models.dart';

void main() {
  group('normaliseCode', () {
    test('accepts codes in the shape they arrive from chat apps', () {
      expect(normaliseCode('  bw6e15de93 '), 'BW6E15DE93');
      expect(normaliseCode('Booking code: BW6E15DE93'), 'BW6E15DE93');
      expect(normaliseCode('BW-6E15-DE93'), 'BW6E15DE93');
    });

    test('leaves a clean code alone and yields empty for junk', () {
      expect(normaliseCode('BW6E15DE93'), 'BW6E15DE93');
      expect(normaliseCode('  !! '), '');
    });
  });

  group('SlipstreamApi.resolve', () {
    final slipJson = {
      'slip': {
        'code': 'BW6E15DE93',
        'combinedOdds': 3.94,
        'isSingleBet': false,
        'betwayUrl': 'https://www.betway.com.ng/?bookingCode=BW6E15DE93',
        'selections': [
          {
            'outcomeId': '6330296311',
            'outcomeName': 'Minnesota Twins',
            'marketName': '1X2',
            'odds': {'decimal': 1.97, 'numerator': 97, 'denominator': 100},
            'event': {
              'name': 'Minnesota Twins vs. Detroit Tigers',
              'league': 'MLB',
              'startsAt': '2026-09-10T18:00:00.000Z',
              'isLive': false,
            },
            'isOutcomeActive': true,
            'isMarketActive': true,
            'isEventActive': true,
          },
        ],
      },
    };

    test('parses a slip and normalises the code into the request path', () async {
      late Uri requested;
      final api = SlipstreamApi(
        baseUrl: 'https://api.test',
        client: MockClient((req) async {
          requested = req.url;
          return http.Response(jsonEncode(slipJson), 200);
        }),
      );

      final slip = await api.resolve(' bw6e15de93 ');

      expect(requested.path, '/api/slips/BW6E15DE93');
      expect(slip.selections.single.outcomeName, 'Minnesota Twins');
      expect(slip.selections.single.odds.display, '1.97');
      expect(slip.selections.single.isLive, isTrue);
    });

    test('surfaces the API error code, not just an HTTP status', () async {
      // The UI branches on this: a mistyped code and a Betway outage are both
      // 4xx/5xx but need completely different copy.
      final api = SlipstreamApi(
        baseUrl: 'https://api.test',
        client: MockClient(
          (_) async => http.Response(
            jsonEncode({'code': 'INVALID_CODE', 'message': 'Betway does not recognise that code.'}),
            404,
          ),
        ),
      );

      expect(
        () => api.resolve('ZZZZ9999'),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVALID_CODE')),
      );
    });

    test('marks a leg dead when any one of the three activity flags is false', () async {
      final dead = jsonDecode(jsonEncode(slipJson)) as Map<String, dynamic>;
      (dead['slip']['selections'][0] as Map<String, dynamic>)['isMarketActive'] = false;

      final api = SlipstreamApi(
        baseUrl: 'https://api.test',
        client: MockClient((_) async => http.Response(jsonEncode(dead), 200)),
      );

      expect((await api.resolve('BW6E15DE93')).selections.single.isLive, isFalse);
    });
  });
}
