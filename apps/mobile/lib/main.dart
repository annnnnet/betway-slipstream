import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'models.dart';

void main() => runApp(const SlipstreamApp());

// The web app's palette, transcribed. Keeping the two surfaces recognisably
// the same product matters more here than reaching for Material's defaults.
const _bg = Color(0xFF0F1117);
const _card = Color(0xFF1A1D26);
const _jade = Color(0xFF4ADE9B);
const _amber = Color(0xFFF5C451);
const _rose = Color(0xFFF87171);
const _muted = Color(0xFF9AA1B1);

class SlipstreamApp extends StatelessWidget {
  const SlipstreamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Slipstream',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: _bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _jade,
          brightness: Brightness.dark,
        ).copyWith(surface: _bg, primary: _jade),
      ),
      home: const SlipScreen(),
    );
  }
}

class SlipScreen extends StatefulWidget {
  const SlipScreen({super.key});

  @override
  State<SlipScreen> createState() => _SlipScreenState();
}

class _SlipScreenState extends State<SlipScreen> {
  final _controller = TextEditingController();
  final _api = SlipstreamApi();

  Slip? _slip;
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _decode() async {
    final code = normaliseCode(_controller.text);
    if (code.length < 4) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
      // Clear the previous slip: leaving it on screen under a spinner makes a
      // failed lookup look like it returned the old result.
      _slip = null;
    });

    try {
      final slip = await _api.resolve(code);
      if (mounted) setState(() => _slip = slip);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: _bg,
        title: const Text('Slipstream', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      textCapitalization: TextCapitalization.characters,
                      autocorrect: false,
                      onSubmitted: (_) => _decode(),
                      style: const TextStyle(fontFamily: 'monospace', letterSpacing: 2),
                      decoration: InputDecoration(
                        hintText: 'Booking code',
                        hintStyle: const TextStyle(color: _muted, letterSpacing: 0),
                        filled: true,
                        fillColor: _card,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: _loading ? null : _decode,
                    style: FilledButton.styleFrom(
                      backgroundColor: _jade,
                      foregroundColor: _bg,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                    ),
                    child: _loading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: _bg),
                          )
                        : const Text('Decode'),
                  ),
                ],
              ),
            ),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _Centered(icon: Icons.error_outline, color: _rose, text: _error!);
    }
    if (_slip == null) {
      return const _Centered(
        icon: Icons.confirmation_number_outlined,
        color: _muted,
        text: 'Paste a Betway booking code to see every leg, market and price on it.',
      );
    }
    return _SlipList(slip: _slip!);
  }
}

class _SlipList extends StatelessWidget {
  const _SlipList({required this.slip});

  final Slip slip;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(12)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: SelectableText(
                      slip.code,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 3,
                        color: _jade,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Copy code',
                    icon: const Icon(Icons.copy, size: 18, color: _muted),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: slip.code));
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Copied ${slip.code}')),
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _Stat(
                    label: slip.isSingleBet ? 'Singles' : 'Accumulator',
                    value: '${slip.selections.length} '
                        '${slip.selections.length == 1 ? "leg" : "legs"}',
                  ),
                  const SizedBox(width: 28),
                  // Combined odds are the product of the legs and are
                  // meaningless on a singles slip, where each settles alone.
                  if (!slip.isSingleBet)
                    _Stat(
                      label: 'Total odds',
                      value: slip.combinedOdds.toStringAsFixed(2),
                      color: _amber,
                      big: true,
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ...slip.selections.map((s) => _SelectionTile(selection: s)),
      ],
    );
  }
}

class _SelectionTile extends StatelessWidget {
  const _SelectionTile({required this.selection});

  final Selection selection;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: selection.isLive ? 1 : 0.5,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(12)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    selection.outcomeName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(selection.marketName, style: const TextStyle(color: _muted, fontSize: 13)),
                  const SizedBox(height: 6),
                  Text(selection.event.name, style: const TextStyle(fontSize: 13)),
                  if (selection.event.league != null)
                    Text(
                      selection.event.league!,
                      style: const TextStyle(color: _muted, fontSize: 12),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  selection.odds.display,
                  style: const TextStyle(
                    color: _amber,
                    fontWeight: FontWeight.w700,
                    fontSize: 17,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                Text(
                  selection.odds.fraction,
                  style: const TextStyle(color: _muted, fontSize: 11),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.color, this.big = false});

  final String label;
  final String value;
  final Color? color;
  final bool big;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: _muted, fontSize: 12)),
        Text(
          value,
          style: TextStyle(
            color: color ?? Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: big ? 24 : 15,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

class _Centered extends StatelessWidget {
  const _Centered({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(height: 12),
            Text(
              text,
              textAlign: TextAlign.center,
              style: const TextStyle(color: _muted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
