import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

/// Talks to the Slipstream API — never to Betway directly.
///
/// The mapping, the fingerprinting and the verification all live server-side,
/// so the phone stays a thin client: shipping that logic into the app would
/// mean a Betway change needs an app-store release to fix, instead of a deploy.
class SlipstreamApi {
  SlipstreamApi({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? _defaultBaseUrl,
        _client = client ?? http.Client();

  /// Supplied at build time with
  /// `flutter build apk --dart-define=API_URL=https://...`.
  static const _defaultBaseUrl =
      String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');

  final String baseUrl;
  final http.Client _client;

  Future<Slip> resolve(String code) async {
    final normalised = normaliseCode(code);
    final uri = Uri.parse('$baseUrl/api/slips/$normalised');

    late http.Response res;
    try {
      res = await _client.get(uri).timeout(const Duration(seconds: 20));
    } catch (_) {
      throw const ApiException('INTERNAL', 'Could not reach the server. Check your connection.');
    }

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400) {
      throw ApiException(
        body['code'] as String? ?? 'INTERNAL',
        body['message'] as String? ?? 'Something went wrong.',
      );
    }
    return Slip.fromJson(body['slip'] as Map<String, dynamic>);
  }
}

/// Booking codes are pasted out of chat apps, so accept them as they arrive —
/// lower case, spaced, or with the "Booking code:" preamble attached — rather
/// than making someone hand-clean a string on a phone keyboard.
String normaliseCode(String raw) => raw
    .trim()
    .toUpperCase()
    .replaceAll(RegExp(r'^(BOOKING\s*)?CODE[:\s]+', caseSensitive: false), '')
    .replaceAll(RegExp(r'[^A-Z0-9]'), '');
