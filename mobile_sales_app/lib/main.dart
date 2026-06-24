import 'dart:convert';
import 'dart:ui' show PointerDeviceKind;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(const RecyclrSalesApp());
}

class RecyclrSalesApp extends StatelessWidget {
  const RecyclrSalesApp({super.key});

  @override
  Widget build(BuildContext context) {
    const purple = Color(0xFF6D00E8);
    const navy = Color(0xFF0D0338);

    return MaterialApp(
      title: 'Recyclr Sales',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: navy,
        colorScheme: ColorScheme.fromSeed(
          seedColor: purple,
          primary: purple,
          secondary: const Color(0xFF00A651),
          surface: Colors.white,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF3F0FF),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFE3DAFF)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFE3DAFF)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: purple, width: 2),
          ),
        ),
      ),
      home: const SessionGate(),
    );
  }
}

class SessionGate extends StatefulWidget {
  const SessionGate({super.key});

  @override
  State<SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<SessionGate> {
  bool loading = true;
  StaffSession? session;

  @override
  void initState() {
    super.initState();
    loadSession();
  }

  Future<void> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final username = prefs.getString('staff_username') ?? '';
    final backendUrl = prefs.getString('backend_url') ?? defaultBackendUrl();
    final role = prefs.getString('staff_role') ?? '';
    final token = prefs.getString('staff_token') ?? '';
    setState(() {
      session = username.isEmpty || token.isEmpty
          ? null
          : StaffSession(
              username: username,
              role: role,
              backendUrl: backendUrl,
              token: token,
            );
      loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (session == null) {
      return LoginPage(onLoggedIn: (value) => setState(() => session = value));
    }
    return HomePage(
      session: session!,
      onLogout: () async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove('staff_username');
        await prefs.remove('staff_role');
        await prefs.remove('staff_token');
        setState(() => session = null);
      },
    );
  }
}

String defaultBackendUrl() {
  const configuredBackend = String.fromEnvironment('API_BASE_URL');
  if (configuredBackend.isNotEmpty) {
    return configuredBackend;
  }
  return 'https://recyclr-crm-backend.onrender.com';
}

class StaffSession {
  const StaffSession({
    required this.username,
    required this.role,
    required this.backendUrl,
    required this.token,
  });

  final String username;
  final String role;
  final String backendUrl;
  final String token;

  Map<String, String> get jsonHeaders => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer $token',
    'X-Staff-Username': username,
  };

  Uri uri(String path) {
    final cleanBase = backendUrl.replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$cleanBase$path');
  }
}

class StylusTextField extends StatefulWidget {
  const StylusTextField({
    super.key,
    required this.controller,
    this.keyboardType,
    this.decoration,
    this.obscureText = false,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final TextInputType? keyboardType;
  final InputDecoration? decoration;
  final bool obscureText;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  State<StylusTextField> createState() => _StylusTextFieldState();
}

class _StylusTextFieldState extends State<StylusTextField> {
  final focusNode = FocusNode();

  @override
  void dispose() {
    focusNode.dispose();
    super.dispose();
  }

  void focusForStylus(PointerDeviceKind kind) {
    if (kind == PointerDeviceKind.stylus || kind == PointerDeviceKind.invertedStylus) {
      focusNode.requestFocus();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !focusNode.hasFocus) return;
        SystemChannels.textInput.invokeMethod<void>('TextInput.show');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      opaque: true,
      cursor: SystemMouseCursors.text,
      onHover: (event) => focusForStylus(event.kind),
      child: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerHover: (event) => focusForStylus(event.kind),
        onPointerMove: (event) => focusForStylus(event.kind),
        onPointerDown: (event) => focusForStylus(event.kind),
        child: TextField(
          controller: widget.controller,
          focusNode: focusNode,
          keyboardType: widget.keyboardType,
          decoration: widget.decoration,
          obscureText: widget.obscureText,
          textInputAction: widget.textInputAction,
          stylusHandwritingEnabled: true,
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted,
        ),
      ),
    );
  }
}

class StylusTextFormField extends StatefulWidget {
  const StylusTextFormField({
    super.key,
    required this.controller,
    this.keyboardType,
    this.decoration,
    this.validator,
    this.minLines,
    this.maxLines = 1,
    this.readOnly = false,
    this.onTap,
  });

  final TextEditingController controller;
  final TextInputType? keyboardType;
  final InputDecoration? decoration;
  final FormFieldValidator<String>? validator;
  final int? minLines;
  final int? maxLines;
  final bool readOnly;
  final VoidCallback? onTap;

  @override
  State<StylusTextFormField> createState() => _StylusTextFormFieldState();
}

class _StylusTextFormFieldState extends State<StylusTextFormField> {
  final focusNode = FocusNode();

  @override
  void dispose() {
    focusNode.dispose();
    super.dispose();
  }

  void focusForStylus(PointerDeviceKind kind) {
    if (kind == PointerDeviceKind.stylus || kind == PointerDeviceKind.invertedStylus) {
      focusNode.requestFocus();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !focusNode.hasFocus) return;
        SystemChannels.textInput.invokeMethod<void>('TextInput.show');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      opaque: true,
      cursor: SystemMouseCursors.text,
      onHover: (event) => focusForStylus(event.kind),
      child: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerHover: (event) => focusForStylus(event.kind),
        onPointerMove: (event) => focusForStylus(event.kind),
        onPointerDown: (event) => focusForStylus(event.kind),
        child: TextFormField(
          controller: widget.controller,
          focusNode: focusNode,
          keyboardType: widget.keyboardType,
          decoration: widget.decoration,
          validator: widget.validator,
          minLines: widget.minLines,
          maxLines: widget.maxLines,
          readOnly: widget.readOnly,
          onTap: widget.onTap,
          stylusHandwritingEnabled: true,
        ),
      ),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.onLoggedIn});

  final ValueChanged<StaffSession> onLoggedIn;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final usernameController = TextEditingController();
  final passwordController = TextEditingController();
  final backendController = TextEditingController(text: defaultBackendUrl());
  bool saving = false;
  String error = '';

  @override
  void initState() {
    super.initState();
    loadSavedBackend();
  }

  Future<void> loadSavedBackend() async {
    final prefs = await SharedPreferences.getInstance();
    backendController.text =
        prefs.getString('backend_url') ?? defaultBackendUrl();
  }

  Future<void> login() async {
    setState(() {
      saving = true;
      error = '';
    });
    try {
      final backendUrl = backendController.text.trim().replaceAll(
        RegExp(r'/+$'),
        '',
      );
      final response = await http.post(
        Uri.parse('$backendUrl/api/auth/login/'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'username': usernameController.text.trim(),
          'password': passwordController.text,
        }),
      );

      Map<String, dynamic> data = {};
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          data = decoded;
        }
      } catch (_) {}

      if (response.statusCode >= 400 || data['success'] != true) {
        final serverMessage = data['message']?.toString().trim();
        if (serverMessage != null && serverMessage.isNotEmpty) {
          throw Exception(serverMessage);
        }
        final bodyPreview = response.body.trim().replaceAll(
          RegExp(r'\s+'),
          ' ',
        );
        final preview = bodyPreview.length > 140
            ? bodyPreview.substring(0, 140)
            : bodyPreview;
        throw Exception('Backend returned ${response.statusCode}. $preview');
      }

      final prefs = await SharedPreferences.getInstance();
      final username = (data['username'] ?? usernameController.text.trim())
          .toString();
      final role = (data['role'] ?? '').toString();
      final token = (data['token'] ?? '').toString();
      if (token.isEmpty) {
        throw Exception('Login worked but the CRM did not return a session token.');
      }
      await prefs.setString('backend_url', backendUrl);
      await prefs.setString('staff_username', username);
      await prefs.setString('staff_role', role);
      await prefs.setString('staff_token', token);

      widget.onLoggedIn(
        StaffSession(
          username: username,
          role: role,
          backendUrl: backendUrl,
          token: token,
        ),
      );
    } catch (err) {
      var message = err.toString().replaceFirst('Exception: ', '');
      final lowerMessage = message.toLowerCase();
      if (lowerMessage.contains('<html') ||
          lowerMessage.contains('<!doctype')) {
        message =
            'The backend returned a server error. Please try again after the latest deploy.';
      }
      setState(() {
        error = message;
      });
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: CardShell(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Recyclr Sales',
                      style: TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Sign in with your CRM staff account.',
                      style: TextStyle(
                        color: Color(0xFF52607A),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 28),
                    StylusTextField(
                      controller: backendController,
                      keyboardType: TextInputType.url,
                      decoration: const InputDecoration(
                        labelText: 'CRM backend URL',
                        helperText:
                            'Use your PC Wi-Fi IP, for example http://192.168.1.25:8000',
                      ),
                    ),
                    const SizedBox(height: 16),
                    StylusTextField(
                      controller: usernameController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Username'),
                    ),
                    const SizedBox(height: 16),
                    StylusTextField(
                      controller: passwordController,
                      obscureText: true,
                      onSubmitted: (_) => login(),
                      decoration: const InputDecoration(labelText: 'Password'),
                    ),
                    if (error.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      ErrorBox(message: error),
                    ],
                    const SizedBox(height: 22),
                    FilledButton(
                      onPressed: saving ? null : login,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: Text(saving ? 'Signing in...' : 'Log In'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key, required this.session, required this.onLogout});

  final StaffSession session;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF16035C),
        foregroundColor: Colors.white,
        title: const Text('Recyclr Core'),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Text(
                session.username,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
          IconButton(onPressed: onLogout, icon: const Icon(Icons.logout)),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Where are you going?',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Tablet tools for field sales.',
                style: TextStyle(
                  color: Colors.white70,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 24),
              Expanded(
                child: GridView.count(
                  crossAxisCount: MediaQuery.of(context).size.width > 900
                      ? 3
                      : 2,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                  childAspectRatio: 1.45,
                  children: [
                    HomeTile(
                      icon: Icons.dashboard,
                      title: 'Dashboard',
                      subtitle: 'Company snapshot',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => DashboardPage(session: session),
                        ),
                      ),
                    ),
                    HomeTile(
                      icon: Icons.handshake,
                      title: 'Sales',
                      subtitle: 'Leads and prospect capture',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => SalesPage(session: session),
                        ),
                      ),
                    ),
                    const DisabledTile(
                      icon: Icons.calendar_month,
                      title: 'Calendar',
                      subtitle: 'Coming later',
                    ),
                    const DisabledTile(
                      icon: Icons.route,
                      title: 'Jobs',
                      subtitle: 'Coming later',
                    ),
                    const DisabledTile(
                      icon: Icons.receipt_long,
                      title: 'Expenses',
                      subtitle: 'Coming later',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key, required this.session});

  final StaffSession session;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  Map<String, dynamic>? data;
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    loadDashboard();
  }

  Future<void> loadDashboard() async {
    setState(() {
      loading = true;
      error = '';
    });
    try {
      final response = await http.get(
        widget.session.uri('/api/dashboard/overview/'),
        headers: widget.session.jsonHeaders,
      );
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode >= 400) {
        throw Exception(decoded['message'] ?? 'Could not load dashboard.');
      }
      setState(() => data = decoded);
    } catch (err) {
      setState(() => error = err.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Map<String, dynamic> get summary =>
      (data?['summary'] as Map<String, dynamic>?) ?? {};

  Map<String, dynamic> get attention =>
      (data?['attention'] as Map<String, dynamic>?) ?? {};

  List<dynamic> get topCustomers => (data?['top_customers'] as List?) ?? [];

  List<dynamic> get servicesByWaste =>
      (data?['services_by_waste_type'] as List?) ?? [];

  @override
  Widget build(BuildContext context) {
    final serviceTotal = servicesByWaste
        .whereType<Map<String, dynamic>>()
        .fold<int>(
          0,
          (total, stream) => total + intValue(stream['service_count']),
        );

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF16035C),
        foregroundColor: Colors.white,
        title: const Text('Dashboard'),
        actions: [
          IconButton(onPressed: loadDashboard, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: loadDashboard,
          child: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              DashboardHero(
                revenue: moneyValue(summary['total_monthly_revenue']),
                customers: textValue(summary['active_customers']),
                services: textValue(summary['active_services']),
                dueToday: textValue(summary['todays_jobs']),
              ),
              const SizedBox(height: 18),
              if (error.isNotEmpty) ...[
                ErrorBox(message: error),
                const SizedBox(height: 14),
              ],
              if (loading && data == null)
                const CardShell(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.all(22),
                      child: CircularProgressIndicator(),
                    ),
                  ),
                )
              else ...[
                ResponsiveFields(
                  children: [
                    DashboardMetric(
                      icon: Icons.payments,
                      label: 'Monthly Revenue',
                      value: moneyValue(summary['total_monthly_revenue']),
                      color: const Color(0xFF00A651),
                      tint: const Color(0xFFE9FFF3),
                    ),
                    DashboardMetric(
                      icon: Icons.business,
                      label: 'Active Customers',
                      value: textValue(summary['active_customers']),
                      color: const Color(0xFF2563EB),
                      tint: const Color(0xFFEFF6FF),
                    ),
                    DashboardMetric(
                      icon: Icons.delete_outline,
                      label: 'Active Services',
                      value: textValue(summary['active_services']),
                      color: const Color(0xFFFF6B00),
                      tint: const Color(0xFFFFF3E8),
                    ),
                    DashboardMetric(
                      icon: Icons.request_quote,
                      label: 'Quotes Pending',
                      value: textValue(summary['quotes_pending']),
                      color: const Color(0xFF6D00E8),
                      tint: const Color(0xFFF3F0FF),
                    ),
                    DashboardMetric(
                      icon: Icons.local_shipping,
                      label: 'Due Today',
                      value: textValue(summary['todays_jobs']),
                      color: const Color(0xFF0F172A),
                      tint: const Color(0xFFF1F5F9),
                    ),
                    DashboardMetric(
                      icon: Icons.warning_amber,
                      label: 'Overdue / Failed',
                      value:
                          '${textValue(summary['overdue_jobs'])} / ${textValue(summary['failed_jobs'])}',
                      color: const Color(0xFFDC2626),
                      tint: const Color(0xFFFFF1F2),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SectionCard(
                  title: 'Needs attention',
                  child: Column(
                    children: [
                      AttentionRow(
                        label: 'Accepted quotes awaiting setup',
                        value: textValue(
                          attention['accepted_quotes_awaiting_setup_count'],
                        ),
                      ),
                      AttentionRow(
                        label: 'Leads needing follow-up',
                        value: textValue(
                          attention['leads_needing_follow_up_count'],
                        ),
                      ),
                      AttentionRow(
                        label: 'Failed collections',
                        value: textValue(attention['failed_collections_count']),
                      ),
                      AttentionRow(
                        label: 'Pending schedules',
                        value: textValue(summary['pending_schedule_services']),
                      ),
                      AttentionRow(
                        label: 'Signing packs waiting',
                        value: textValue(summary['signing_packs_waiting']),
                      ),
                    ],
                  ),
                ),
                SectionCard(
                  title: 'Top customers',
                  child: topCustomers.isEmpty
                      ? const Text('No active customer revenue yet.')
                      : Column(
                          children: topCustomers
                              .whereType<Map<String, dynamic>>()
                              .map(
                                (customer) => AttentionRow(
                                  label: customer['business_name'].toString(),
                                  value: moneyValue(
                                    customer['monthly_revenue'],
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                ),
                SectionCard(
                  title: 'Service mix',
                  child: servicesByWaste.isEmpty
                      ? const Text('No active services yet.')
                      : Column(
                          children: servicesByWaste
                              .whereType<Map<String, dynamic>>()
                              .map(
                                (stream) => ServiceMixRow(
                                  label: stream['label'].toString(),
                                  count: intValue(stream['service_count']),
                                  revenue: moneyValue(stream['monthly_value']),
                                  total: serviceTotal,
                                ),
                              )
                              .toList(),
                        ),
                ),
              ],
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}

class DashboardHero extends StatelessWidget {
  const DashboardHero({
    super.key,
    required this.revenue,
    required this.customers,
    required this.services,
    required this.dueToday,
  });

  final String revenue;
  final String customers;
  final String services;
  final String dueToday;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: const LinearGradient(
          colors: [Color(0xFF6D00E8), Color(0xFF00A651)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: const BoxDecoration(
                  color: Color(0xFFB6FF00),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Live CRM snapshot',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Text(
            'Out and about',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            revenue,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 44,
              fontWeight: FontWeight.w900,
            ),
          ),
          const Text(
            'current monthly service revenue',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              DashboardHeroChip(
                icon: Icons.business,
                label: '$customers customers',
              ),
              DashboardHeroChip(
                icon: Icons.delete_outline,
                label: '$services services',
              ),
              DashboardHeroChip(
                icon: Icons.local_shipping,
                label: '$dueToday jobs today',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class DashboardHeroChip extends StatelessWidget {
  const DashboardHeroChip({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 18),
          const SizedBox(width: 7),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class DashboardMetric extends StatelessWidget {
  const DashboardMetric({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.tint,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return CardShell(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: tint,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: color,
              foregroundColor: Colors.white,
              child: Icon(icon),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: Color(0xFF475569),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AttentionRow extends StatelessWidget {
  const AttentionRow({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F0FF),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(99),
            ),
            child: Text(
              value,
              style: const TextStyle(
                color: Color(0xFF6D00E8),
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ServiceMixRow extends StatelessWidget {
  const ServiceMixRow({
    super.key,
    required this.label,
    required this.count,
    required this.revenue,
    required this.total,
  });

  final String label;
  final int count;
  final String revenue;
  final int total;

  @override
  Widget build(BuildContext context) {
    final percent = total <= 0 ? 0.0 : count / total;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '$label ($count)',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              Text(
                revenue,
                style: const TextStyle(
                  color: Color(0xFF475569),
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: percent.clamp(0, 1),
              minHeight: 10,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: AlwaysStoppedAnimation<Color>(
                wasteStreamColor(label),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class SalesPage extends StatelessWidget {
  const SalesPage({super.key, required this.session});

  final StaffSession session;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF16035C),
        foregroundColor: Colors.white,
        title: const Text('Sales'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Sales tools',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 18),
              Expanded(
                child: GridView.count(
                  crossAxisCount: MediaQuery.of(context).size.width > 900
                      ? 3
                      : 2,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                  childAspectRatio: 1.5,
                  children: [
                    HomeTile(
                      icon: Icons.person_add_alt_1,
                      title: 'Leads',
                      subtitle: 'Add and update prospects',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => LeadsPage(session: session),
                        ),
                      ),
                    ),
                    const DisabledTile(
                      icon: Icons.request_quote,
                      title: 'Quotes',
                      subtitle: 'Next sales app area',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LeadsPage extends StatefulWidget {
  const LeadsPage({super.key, required this.session});

  final StaffSession session;

  @override
  State<LeadsPage> createState() => _LeadsPageState();
}

class _LeadsPageState extends State<LeadsPage> {
  final searchController = TextEditingController();
  List<Lead> leads = [];
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    loadLeads();
  }

  Future<void> loadLeads() async {
    setState(() {
      loading = true;
      error = '';
    });
    try {
      final response = await http.get(
        widget.session.uri('/api/leads/'),
        headers: {'X-Staff-Username': widget.session.username},
      );
      final data = jsonDecode(response.body);
      if (response.statusCode >= 400) {
        throw Exception(
          data is Map ? data['message'] : 'Could not load leads.',
        );
      }
      setState(
        () =>
            leads = (data as List).map((item) => Lead.fromJson(item)).toList(),
      );
    } catch (err) {
      setState(() => error = 'Could not load leads from the CRM.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openForm([Lead? lead]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => LeadFormPage(session: widget.session, lead: lead),
      ),
    );
    if (saved == true) loadLeads();
  }

  @override
  Widget build(BuildContext context) {
    final query = searchController.text.toLowerCase().trim();
    final filtered = query.isEmpty
        ? leads
        : leads.where((lead) => lead.searchText.contains(query)).toList();
    final dueCount = leads.where((lead) => lead.followUpDue).length;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF16035C),
        foregroundColor: Colors.white,
        title: const Text('Leads'),
        actions: [
          IconButton(onPressed: loadLeads, icon: const Icon(Icons.refresh)),
          const SizedBox(width: 8),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openForm(),
        icon: const Icon(Icons.add),
        label: const Text('New Lead'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: StatCard(label: 'Leads', value: '${leads.length}'),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatCard(label: 'Follow-up due', value: '$dueCount'),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatCard(
                      label: 'Pipeline value',
                      value:
                          'GBP ${leads.fold<double>(0, (sum, lead) => sum + lead.estimatedMonthlyValue).toStringAsFixed(0)}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              StylusTextField(
                controller: searchController,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  labelText: 'Search leads',
                  hintText: 'Company, contact, phone, email, postcode...',
                ),
              ),
              const SizedBox(height: 14),
              Expanded(
                child: CardShell(
                  padding: EdgeInsets.zero,
                  child: loading
                      ? const Center(child: CircularProgressIndicator())
                      : error.isNotEmpty
                      ? Center(child: ErrorBox(message: error))
                      : filtered.isEmpty
                      ? const Center(child: Text('No leads found.'))
                      : ListView.separated(
                          itemCount: filtered.length,
                          separatorBuilder: (context, index) =>
                              const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final lead = filtered[index];
                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 18,
                                vertical: 10,
                              ),
                              title: Text(
                                lead.companyName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(
                                  [
                                    if (lead.contactName.isNotEmpty)
                                      lead.contactName,
                                    if (lead.phone.isNotEmpty) lead.phone,
                                    if (lead.town.isNotEmpty) lead.town,
                                    if (lead.postcode.isNotEmpty) lead.postcode,
                                  ].join('  |  '),
                                ),
                              ),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  StatusPill(text: prettyStatus(lead.status)),
                                  const SizedBox(height: 6),
                                  Text(
                                    lead.followUpDate.isEmpty
                                        ? 'No follow-up'
                                        : 'Follow-up ${formatDate(lead.followUpDate)}',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: lead.followUpDue
                                          ? Colors.red
                                          : Colors.blueGrey,
                                    ),
                                  ),
                                ],
                              ),
                              onTap: () => openForm(lead),
                            );
                          },
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LeadFormPage extends StatefulWidget {
  const LeadFormPage({super.key, required this.session, this.lead});

  final StaffSession session;
  final Lead? lead;

  @override
  State<LeadFormPage> createState() => _LeadFormPageState();
}

class _LeadFormPageState extends State<LeadFormPage> {
  final formKey = GlobalKey<FormState>();
  final companyName = TextEditingController();
  final whoSpokeTo = TextEditingController();
  final contactName = TextEditingController();
  final phone = TextEditingController();
  final secondaryPhone = TextEditingController();
  final email = TextEditingController();
  final leadSourceOther = TextEditingController();
  final addressLine1 = TextEditingController();
  final addressLine2 = TextEditingController();
  final town = TextEditingController();
  final county = TextEditingController();
  final postcode = TextEditingController();
  final followUpDate = TextEditingController();
  final notes = TextEditingController();
  String leadSource = 'door';
  bool saving = false;
  String error = '';

  final streams = <WasteStreamForm>[
    WasteStreamForm(
      title: 'General Waste',
      keyPrefix: 'general_waste',
      streamColor: const Color(0xFF111827),
      defaultSize: '1100',
    ),
    WasteStreamForm(
      title: 'Dry Mixed Recycling',
      keyPrefix: 'recycling',
      streamColor: const Color(0xFF22C55E),
      defaultSize: '1100',
    ),
    WasteStreamForm(
      title: 'Glass',
      keyPrefix: 'glass',
      streamColor: const Color(0xFF94A3B8),
      defaultSize: '240',
      fixedSize: true,
    ),
    WasteStreamForm(
      title: 'Food',
      keyPrefix: 'food',
      streamColor: const Color(0xFF92400E),
      defaultSize: '240',
      fixedSize: true,
    ),
  ];
  final extraStreams = <ExtraWasteStreamForm>[];

  @override
  void initState() {
    super.initState();
    final lead = widget.lead;
    if (lead == null) return;
    companyName.text = lead.companyName;
    whoSpokeTo.text = lead.whoSpokeTo;
    contactName.text = lead.contactName;
    phone.text = lead.phone;
    secondaryPhone.text = lead.secondaryPhone;
    email.text = lead.email;
    leadSource = lead.leadSource.isEmpty ? 'door' : lead.leadSource;
    leadSourceOther.text = lead.leadSourceOther;
    addressLine1.text = lead.addressLine1;
    addressLine2.text = lead.addressLine2;
    town.text = lead.town;
    county.text = lead.county;
    postcode.text = lead.postcode;
    followUpDate.text = lead.followUpDate;
    notes.text = lead.notes;
    for (final stream in streams) {
      stream.fromLead(lead);
    }
    final extras = lead.values['extra_waste_requirements'];
    if (extras is List) {
      extraStreams.addAll(
        extras.whereType<Map<String, dynamic>>().map(
          (item) => ExtraWasteStreamForm.fromJson(item),
        ),
      );
    }
  }

  Future<void> pickFollowUpDate() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: followUpDate.text.isEmpty
          ? now
          : DateTime.tryParse(followUpDate.text) ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 3),
    );
    if (selected != null) {
      followUpDate.text = DateFormat('yyyy-MM-dd').format(selected);
    }
  }

  Map<String, dynamic> payload() {
    final data = <String, dynamic>{
      'company_name': companyName.text.trim(),
      'who_spoke_to': whoSpokeTo.text.trim(),
      'contact_name': contactName.text.trim(),
      'phone': phone.text.trim(),
      'secondary_phone': secondaryPhone.text.trim(),
      'email': email.text.trim(),
      'lead_source': leadSource,
      'lead_source_other': leadSourceOther.text.trim(),
      'address_line_1': addressLine1.text.trim(),
      'address_line_2': addressLine2.text.trim(),
      'town': town.text.trim(),
      'county': county.text.trim(),
      'postcode': postcode.text.trim(),
      'follow_up_date': followUpDate.text.trim(),
      'notes': notes.text.trim(),
    };
    for (final stream in streams) {
      data.addAll(stream.toPayload());
    }
    data['extra_waste_requirements'] = extraStreams
        .map((stream) => stream.toPayload())
        .toList();
    return data;
  }

  Future<void> saveLead() async {
    if (!formKey.currentState!.validate()) return;
    setState(() {
      saving = true;
      error = '';
    });
    try {
      final isEdit = widget.lead != null;
      final path = isEdit ? '/api/leads/${widget.lead!.id}/' : '/api/leads/';
      final response = await http.post(
        widget.session.uri(path),
        headers: widget.session.jsonHeaders,
        body: jsonEncode(payload()),
      );
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode >= 400 || data['success'] != true) {
        throw Exception(data['message'] ?? 'Could not save lead.');
      }
      final savedLead = Lead.fromJson(data['lead'] as Map<String, dynamic>);
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) =>
              QuotePreviewPage(session: widget.session, lead: savedLead),
        ),
      );
    } catch (err) {
      setState(() => error = err.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.lead != null;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF16035C),
        foregroundColor: Colors.white,
        title: Text(isEdit ? 'Edit Lead' : 'New Lead'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton.icon(
              onPressed: saving ? null : saveLead,
              icon: const Icon(Icons.save),
              label: Text(saving ? 'Saving...' : 'Save Lead'),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Form(
          key: formKey,
          child: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              if (error.isNotEmpty) ...[
                ErrorBox(message: error),
                const SizedBox(height: 14),
              ],
              SectionCard(
                title: 'Customer basics',
                child: ResponsiveFields(
                  children: [
                    AppField(
                      controller: companyName,
                      label: 'Company Name',
                      required: true,
                    ),
                    AppField(controller: whoSpokeTo, label: 'Who Spoke To'),
                    AppField(controller: contactName, label: 'Contact Name'),
                    AppField(
                      controller: phone,
                      label: 'Phone',
                      keyboardType: TextInputType.phone,
                    ),
                    AppField(
                      controller: secondaryPhone,
                      label: 'Secondary Phone',
                    ),
                    AppField(
                      controller: email,
                      label: 'Email',
                      keyboardType: TextInputType.emailAddress,
                    ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Address and follow-up',
                child: ResponsiveFields(
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: leadSource,
                      decoration: const InputDecoration(
                        labelText: 'Lead Source',
                      ),
                      items: const [
                        DropdownMenuItem(value: 'door', child: Text('Door')),
                        DropdownMenuItem(
                          value: 'website',
                          child: Text('Website'),
                        ),
                        DropdownMenuItem(
                          value: 'referral',
                          child: Text('Referral'),
                        ),
                        DropdownMenuItem(value: 'phone', child: Text('Phone')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (value) =>
                          setState(() => leadSource = value ?? 'door'),
                    ),
                    if (leadSource == 'other')
                      AppField(
                        controller: leadSourceOther,
                        label: 'Other Lead Source',
                        required: true,
                      ),
                    AppField(controller: addressLine1, label: 'Address Line 1'),
                    AppField(controller: addressLine2, label: 'Address Line 2'),
                    AppField(controller: town, label: 'Town / City'),
                    AppField(controller: county, label: 'County'),
                    AppField(controller: postcode, label: 'Postcode'),
                    StylusTextFormField(
                      controller: followUpDate,
                      readOnly: true,
                      onTap: pickFollowUpDate,
                      decoration: const InputDecoration(
                        labelText: 'Follow Up Date',
                        suffixIcon: Icon(Icons.calendar_month),
                      ),
                    ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Waste requirements',
                child: Column(
                  children: streams
                      .map(
                        (stream) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: WasteStreamCard(
                            stream: stream,
                            onChanged: () => setState(() {}),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              SectionCard(
                title: 'Extra stream lines',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (extraStreams.isEmpty)
                      const Text(
                        'Add another line if the customer wants two sizes of the same waste stream.',
                        style: TextStyle(
                          color: Color(0xFF475569),
                          fontWeight: FontWeight.w700,
                        ),
                      )
                    else
                      ...extraStreams.asMap().entries.map(
                        (entry) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: ExtraWasteStreamCard(
                            stream: entry.value,
                            lineNumber: entry.key + 1,
                            onChanged: () => setState(() {}),
                            onRemove: () => setState(
                              () => extraStreams.removeAt(entry.key),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => setState(
                        () => extraStreams.add(ExtraWasteStreamForm()),
                      ),
                      icon: const Icon(Icons.add_circle_outline),
                      label: const Text('Add extra stream/bin line'),
                    ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Notes',
                child: StylusTextFormField(
                  controller: notes,
                  minLines: 5,
                  maxLines: 8,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    hintText: 'Anything useful from the first call or visit...',
                  ),
                ),
              ),
              const SizedBox(height: 90),
            ],
          ),
        ),
      ),
    );
  }
}

class QuotePreviewPage extends StatefulWidget {
  const QuotePreviewPage({
    super.key,
    required this.session,
    required this.lead,
  });

  final StaffSession session;
  final Lead lead;

  @override
  State<QuotePreviewPage> createState() => _QuotePreviewPageState();
}

class _QuotePreviewPageState extends State<QuotePreviewPage> {
  QuotePreview? preview;
  bool loading = true;
  bool expanded = false;
  String error = '';
  int offerIndex = 1;

  @override
  void initState() {
    super.initState();
    loadPreview();
  }

  Future<void> loadPreview({int? offer}) async {
    final nextOffer = offer ?? offerIndex;
    setState(() {
      loading = true;
      error = '';
    });
    try {
      final response = await http.get(
        widget.session.uri(
          '/api/leads/${widget.lead.id}/quote-preview/?offer=$nextOffer',
        ),
        headers: widget.session.jsonHeaders,
      );
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode >= 400 || data['success'] != true) {
        throw Exception(data['message'] ?? 'Could not generate quote preview.');
      }
      setState(() {
        preview = QuotePreview.fromJson(data);
        offerIndex = nextOffer;
      });
    } catch (err) {
      setState(() => error = err.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> recalculateOffer() async {
    if (loading) return;
    final nextOffer = offerIndex >= 3 ? 3 : offerIndex + 1;
    await loadPreview(offer: nextOffer);
  }

  @override
  Widget build(BuildContext context) {
    final current = preview;
    final canRc = offerIndex < 3;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF16035C),
        foregroundColor: Colors.white,
        title: const Text('Generate Quote'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: TextButton.icon(
              onPressed: () => Navigator.of(context).pop(true),
              icon: const Icon(Icons.list_alt, color: Colors.white),
              label: const Text(
                'Back to Leads',
                style: TextStyle(color: Colors.white),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            if (error.isNotEmpty) ...[
              ErrorBox(message: error),
              const SizedBox(height: 14),
            ],
            CardShell(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.lead.companyName,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.lead.contactName.isEmpty
                        ? 'Lead #${widget.lead.id}'
                        : '${widget.lead.contactName} • Lead #${widget.lead.id}',
                    style: const TextStyle(
                      color: Color(0xFF475569),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            if (loading && current == null)
              const CardShell(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(22),
                    child: CircularProgressIndicator(),
                  ),
                ),
              )
            else if (current != null) ...[
              CardShell(
                padding: const EdgeInsets.all(0),
                child: Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: const BoxDecoration(
                        color: Color(0xFF6D00E8),
                        borderRadius: BorderRadius.vertical(
                          top: Radius.circular(8),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'QUOTE TOTAL',
                            style: TextStyle(
                              color: Colors.white70,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            money(current.monthlyTotal),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 42,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const Text(
                            'Estimated monthly total',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: QuoteMetric(
                                  label: 'Collections',
                                  value: money(current.collectionPerMonth),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: QuoteMetric(
                                  label: 'Bin rental',
                                  value: money(current.rentalPerMonth),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          InkWell(
                            onTap: () => setState(() => expanded = !expanded),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF3F0FF),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    expanded
                                        ? Icons.keyboard_arrow_up
                                        : Icons.keyboard_arrow_down,
                                    color: const Color(0xFF6D00E8),
                                  ),
                                  const SizedBox(width: 8),
                                  const Expanded(
                                    child: Text(
                                      'Full price breakdown',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    '${current.lines.length} line${current.lines.length == 1 ? '' : 's'}',
                                    style: const TextStyle(
                                      color: Color(0xFF475569),
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          if (expanded) ...[
                            const SizedBox(height: 12),
                            ...current.lines.map(
                              (line) => QuoteLineBreakdown(line: line),
                            ),
                            QuoteMetric(
                              label: 'One-off delivery charges',
                              value: money(current.deliveryTotal),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (current.warnings.isNotEmpty) ...[
                const SizedBox(height: 14),
                ErrorBox(message: current.warnings.join('\n')),
              ],
            ],
            const SizedBox(height: 96),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: const BoxDecoration(
            color: Colors.white,
            boxShadow: [BoxShadow(color: Color(0x22000000), blurRadius: 12)],
          ),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: loading ? null : () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.edit_note),
                  label: const Text('Edit Lead'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: loading || !canRc ? null : recalculateOffer,
                  child: Text(
                    loading ? 'Checking...' : 'RC',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class QuoteMetric extends StatelessWidget {
  const QuoteMetric({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class QuoteLineBreakdown extends StatelessWidget {
  const QuoteLineBreakdown({super.key, required this.line});

  final QuotePreviewLine line;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${line.label} • ${line.binSize}L • ${line.binCount} bin${line.binCount == 1 ? '' : 's'} • ${line.collectionsPerWeek}x/week',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          if (line.currentProvider.isNotEmpty || line.currentCost > 0) ...[
            const SizedBox(height: 6),
            Text(
              [
                if (line.currentProvider.isNotEmpty)
                  'Current supplier: ${line.currentProvider}',
                if (line.currentCost > 0)
                  'Current cost: ${money(line.currentCost)} / month',
              ].join(' • '),
              style: const TextStyle(
                color: Color(0xFF475569),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: 10),
          ResponsiveFields(
            children: [
              QuoteMetric(
                label: 'Price / lift',
                value: money(line.pricePerLift),
              ),
              QuoteMetric(
                label: 'Daily rental',
                value: money(line.rentalPerDay),
              ),
              QuoteMetric(
                label: 'Collection / month',
                value: money(line.collectionPerMonth),
              ),
              QuoteMetric(
                label: 'Rental / month',
                value: money(line.rentalPerMonth),
              ),
              QuoteMetric(
                label: 'Delivery / bin',
                value: money(line.deliveryChargePerBin),
              ),
              QuoteMetric(label: 'Line total', value: money(line.lineTotal)),
            ],
          ),
        ],
      ),
    );
  }
}

class QuotePreview {
  QuotePreview({
    required this.label,
    required this.monthlyTotal,
    required this.collectionPerMonth,
    required this.rentalPerMonth,
    required this.deliveryTotal,
    required this.marginPercent,
    required this.lines,
    required this.offerOptions,
    required this.warnings,
  });

  final String label;
  final double monthlyTotal;
  final double collectionPerMonth;
  final double rentalPerMonth;
  final double deliveryTotal;
  final double marginPercent;
  final List<QuotePreviewLine> lines;
  final List<QuoteOfferOption> offerOptions;
  final List<String> warnings;

  factory QuotePreview.fromJson(Map<String, dynamic> json) {
    final totals = (json['totals'] as Map<String, dynamic>?) ?? {};
    double number(String key) => (totals[key] as num?)?.toDouble() ?? 0;
    return QuotePreview(
      label: (json['label'] ?? 'Quote').toString(),
      monthlyTotal: number('monthly_total'),
      collectionPerMonth: number('collection_per_month'),
      rentalPerMonth: number('rental_per_month'),
      deliveryTotal: number('delivery_total'),
      marginPercent: number('margin_percent'),
      lines: ((json['lines'] as List?) ?? [])
          .whereType<Map<String, dynamic>>()
          .map(QuotePreviewLine.fromJson)
          .toList(),
      offerOptions: ((json['offer_options'] as List?) ?? [])
          .whereType<Map<String, dynamic>>()
          .map(QuoteOfferOption.fromJson)
          .toList(),
      warnings: ((json['warnings'] as List?) ?? [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class QuotePreviewLine {
  QuotePreviewLine({
    required this.label,
    required this.binSize,
    required this.binCount,
    required this.collectionsPerWeek,
    required this.pricePerLift,
    required this.rentalPerDay,
    required this.deliveryChargePerBin,
    required this.collectionPerMonth,
    required this.rentalPerMonth,
    required this.lineTotal,
    required this.currentProvider,
    required this.currentCost,
  });

  final String label;
  final String binSize;
  final int binCount;
  final int collectionsPerWeek;
  final double pricePerLift;
  final double rentalPerDay;
  final double deliveryChargePerBin;
  final double collectionPerMonth;
  final double rentalPerMonth;
  final double lineTotal;
  final String currentProvider;
  final double currentCost;

  factory QuotePreviewLine.fromJson(Map<String, dynamic> json) {
    double number(String key) => (json[key] as num?)?.toDouble() ?? 0;
    return QuotePreviewLine(
      label: (json['label'] ?? '').toString(),
      binSize: (json['bin_size'] ?? '').toString(),
      binCount: (json['bin_count'] as num?)?.toInt() ?? 0,
      collectionsPerWeek: (json['collections_per_week'] as num?)?.toInt() ?? 0,
      pricePerLift: number('price_per_lift'),
      rentalPerDay: number('rental_per_day'),
      deliveryChargePerBin: number('delivery_charge_per_bin'),
      collectionPerMonth: number('collection_per_month'),
      rentalPerMonth: number('rental_per_month'),
      lineTotal: number('line_total_per_month'),
      currentProvider: (json['current_provider'] ?? '').toString(),
      currentCost: number('current_cost'),
    );
  }
}

class QuoteOfferOption {
  QuoteOfferOption({
    required this.index,
    required this.label,
    required this.monthlyTotal,
  });

  final int index;
  final String label;
  final double monthlyTotal;

  factory QuoteOfferOption.fromJson(Map<String, dynamic> json) {
    return QuoteOfferOption(
      index: (json['index'] as num?)?.toInt() ?? 0,
      label: (json['label'] ?? '').toString(),
      monthlyTotal: (json['monthly_total'] as num?)?.toDouble() ?? 0,
    );
  }
}

class Lead {
  Lead({
    required this.id,
    required this.companyName,
    required this.whoSpokeTo,
    required this.contactName,
    required this.phone,
    required this.secondaryPhone,
    required this.email,
    required this.status,
    required this.leadSource,
    required this.leadSourceOther,
    required this.addressLine1,
    required this.addressLine2,
    required this.town,
    required this.county,
    required this.postcode,
    required this.followUpDate,
    required this.estimatedMonthlyValue,
    required this.notes,
    required this.values,
  });

  final int id;
  final String companyName;
  final String whoSpokeTo;
  final String contactName;
  final String phone;
  final String secondaryPhone;
  final String email;
  final String status;
  final String leadSource;
  final String leadSourceOther;
  final String addressLine1;
  final String addressLine2;
  final String town;
  final String county;
  final String postcode;
  final String followUpDate;
  final double estimatedMonthlyValue;
  final String notes;
  final Map<String, dynamic> values;

  factory Lead.fromJson(Map<String, dynamic> json) {
    String text(String key) => (json[key] ?? '').toString();
    return Lead(
      id: (json['id'] as num?)?.toInt() ?? 0,
      companyName: text('company_name'),
      whoSpokeTo: text('who_spoke_to'),
      contactName: text('contact_name'),
      phone: text('phone'),
      secondaryPhone: text('secondary_phone'),
      email: text('email'),
      status: text('status'),
      leadSource: text('lead_source'),
      leadSourceOther: text('lead_source_other'),
      addressLine1: text('address_line_1'),
      addressLine2: text('address_line_2'),
      town: text('town'),
      county: text('county'),
      postcode: text('postcode'),
      followUpDate: text('follow_up_date'),
      estimatedMonthlyValue:
          (json['estimated_monthly_value'] as num?)?.toDouble() ?? 0,
      notes: text('notes'),
      values: json,
    );
  }

  String get searchText => [
    companyName,
    whoSpokeTo,
    contactName,
    phone,
    secondaryPhone,
    email,
    town,
    county,
    postcode,
  ].join(' ').toLowerCase();

  bool get followUpDue {
    if (followUpDate.isEmpty) return false;
    final date = DateTime.tryParse(followUpDate);
    if (date == null) return false;
    final today = DateTime.now();
    final todayOnly = DateTime(today.year, today.month, today.day);
    return !date.isAfter(todayOnly);
  }
}

class WasteStreamForm {
  WasteStreamForm({
    required this.title,
    required this.keyPrefix,
    required this.streamColor,
    required this.defaultSize,
    this.fixedSize = false,
  }) {
    binSize = defaultSize;
  }

  final String title;
  final String keyPrefix;
  final Color streamColor;
  final String defaultSize;
  final bool fixedSize;

  bool required = false;
  int binCount = 1;
  String binSize = '1100';
  int collectionsPerWeek = 1;
  bool lockRequired = false;
  bool metalBinRequired = false;
  final currentProvider = TextEditingController();
  final currentCost = TextEditingController();

  void fromLead(Lead lead) {
    bool boolValue(String suffix) =>
        lead.values['${keyPrefix}_$suffix'] == true;
    int intValue(String suffix, int fallback) =>
        (lead.values['${keyPrefix}_$suffix'] as num?)?.toInt() ?? fallback;
    String textValue(String suffix, String fallback) =>
        (lead.values['${keyPrefix}_$suffix'] ?? fallback).toString();

    required = boolValue('required');
    binCount = intValue('bin_count', 1);
    binSize = textValue('bin_size', defaultSize);
    collectionsPerWeek = intValue('collections_per_week', 1);
    lockRequired = boolValue('lock_required');
    metalBinRequired = boolValue('metal_bin_required');
    currentProvider.text = textValue('current_provider', '');
    final cost = lead.values['${keyPrefix}_current_cost'];
    currentCost.text = cost == null || cost.toString() == '0'
        ? ''
        : cost.toString();
  }

  Map<String, dynamic> toPayload() {
    return {
      '${keyPrefix}_required': required,
      '${keyPrefix}_bin_count': required ? binCount : null,
      '${keyPrefix}_bin_size': required ? binSize : defaultSize,
      '${keyPrefix}_collections_per_week': required ? collectionsPerWeek : null,
      '${keyPrefix}_lock_required': lockRequired,
      '${keyPrefix}_metal_bin_required': metalBinRequired,
      '${keyPrefix}_current_provider': currentProvider.text.trim(),
      '${keyPrefix}_current_cost': currentCost.text.trim(),
    };
  }
}

class ExtraWasteStreamForm {
  ExtraWasteStreamForm();

  String wasteType = 'general';
  int binCount = 1;
  String binSize = '1100';
  int collectionsPerWeek = 1;
  bool lockRequired = false;
  bool metalBinRequired = false;
  final currentProvider = TextEditingController();
  final currentCost = TextEditingController();

  factory ExtraWasteStreamForm.fromJson(Map<String, dynamic> json) {
    final form = ExtraWasteStreamForm();
    form.wasteType = (json['waste_type'] ?? 'general').toString();
    form.binCount = (json['bin_count'] as num?)?.toInt() ?? 1;
    form.binSize = (json['bin_size'] ?? '1100').toString();
    form.collectionsPerWeek =
        (json['collections_per_week'] as num?)?.toInt() ?? 1;
    form.lockRequired = json['lock_required'] == true;
    form.metalBinRequired = json['metal_bin_required'] == true;
    form.currentProvider.text = (json['current_provider'] ?? '').toString();
    final cost = json['current_cost'];
    form.currentCost.text = cost == null || cost.toString() == '0'
        ? ''
        : cost.toString();
    return form;
  }

  String get title => switch (wasteType) {
    'recycling' => 'Dry Mixed Recycling',
    'glass' => 'Glass',
    'food' => 'Food',
    _ => 'General Waste',
  };

  Color get streamColor => switch (wasteType) {
    'recycling' => const Color(0xFF22C55E),
    'glass' => const Color(0xFF94A3B8),
    'food' => const Color(0xFF92400E),
    _ => const Color(0xFF111827),
  };

  bool get fixedSize => wasteType == 'glass' || wasteType == 'food';

  Map<String, dynamic> toPayload() {
    return {
      'waste_type': wasteType,
      'bin_count': binCount,
      'bin_size': fixedSize ? '240' : binSize,
      'collections_per_week': collectionsPerWeek,
      'lock_required': lockRequired,
      'metal_bin_required': metalBinRequired,
      'current_provider': currentProvider.text.trim(),
      'current_cost': currentCost.text.trim(),
    };
  }
}

class WasteStreamCard extends StatelessWidget {
  const WasteStreamCard({
    super.key,
    required this.stream,
    required this.onChanged,
  });

  final WasteStreamForm stream;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final sizes = stream.fixedSize ? ['240'] : ['240', '360', '660', '1100'];
    return Container(
      decoration: BoxDecoration(
        color: stream.required ? Colors.white : const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: stream.streamColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  stream.title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Switch(
                value: stream.required,
                onChanged: (value) {
                  stream.required = value;
                  onChanged();
                },
              ),
            ],
          ),
          if (stream.required) ...[
            const SizedBox(height: 12),
            ResponsiveFields(
              children: [
                NumberStepper(
                  label: 'Bin Count',
                  value: stream.binCount,
                  onChanged: (value) {
                    stream.binCount = value;
                    onChanged();
                  },
                ),
                DropdownButtonFormField<String>(
                  initialValue: sizes.contains(stream.binSize)
                      ? stream.binSize
                      : sizes.last,
                  decoration: const InputDecoration(labelText: 'Bin Size'),
                  items: sizes
                      .map(
                        (size) => DropdownMenuItem(
                          value: size,
                          child: Text('${size}L'),
                        ),
                      )
                      .toList(),
                  onChanged: stream.fixedSize
                      ? null
                      : (value) {
                          stream.binSize = value ?? stream.defaultSize;
                          onChanged();
                        },
                ),
                NumberStepper(
                  label: 'Collections / Week',
                  value: stream.collectionsPerWeek,
                  onChanged: (value) {
                    stream.collectionsPerWeek = value;
                    onChanged();
                  },
                ),
              ],
            ),
            Wrap(
              spacing: 12,
              children: [
                FilterChip(
                  label: const Text('Lock required'),
                  selected: stream.lockRequired,
                  onSelected: (value) {
                    stream.lockRequired = value;
                    onChanged();
                  },
                ),
                FilterChip(
                  label: const Text('Metal bin required'),
                  selected: stream.metalBinRequired,
                  onSelected: (value) {
                    stream.metalBinRequired = value;
                    onChanged();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            ResponsiveFields(
              children: [
                AppField(
                  controller: stream.currentProvider,
                  label: 'Current Supplier',
                ),
                AppField(
                  controller: stream.currentCost,
                  label: 'Current Monthly Cost',
                  keyboardType: TextInputType.number,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class ExtraWasteStreamCard extends StatelessWidget {
  const ExtraWasteStreamCard({
    super.key,
    required this.stream,
    required this.lineNumber,
    required this.onChanged,
    required this.onRemove,
  });

  final ExtraWasteStreamForm stream;
  final int lineNumber;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final sizes = stream.fixedSize ? ['240'] : ['240', '360', '660', '1100'];
    if (!sizes.contains(stream.binSize)) {
      stream.binSize = sizes.last;
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: stream.streamColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Extra Line $lineNumber',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: onRemove,
                icon: const Icon(Icons.delete_outline),
                label: const Text('Remove'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ResponsiveFields(
            children: [
              DropdownButtonFormField<String>(
                initialValue: stream.wasteType,
                decoration: const InputDecoration(labelText: 'Waste Stream'),
                items: const [
                  DropdownMenuItem(
                    value: 'general',
                    child: Text('General Waste'),
                  ),
                  DropdownMenuItem(
                    value: 'recycling',
                    child: Text('Dry Mixed Recycling'),
                  ),
                  DropdownMenuItem(value: 'glass', child: Text('Glass')),
                  DropdownMenuItem(value: 'food', child: Text('Food')),
                ],
                onChanged: (value) {
                  stream.wasteType = value ?? 'general';
                  if (stream.fixedSize) stream.binSize = '240';
                  onChanged();
                },
              ),
              NumberStepper(
                label: 'Bin Count',
                value: stream.binCount,
                onChanged: (value) {
                  stream.binCount = value;
                  onChanged();
                },
              ),
              DropdownButtonFormField<String>(
                initialValue: sizes.contains(stream.binSize)
                    ? stream.binSize
                    : sizes.last,
                decoration: const InputDecoration(labelText: 'Bin Size'),
                items: sizes
                    .map(
                      (size) => DropdownMenuItem(
                        value: size,
                        child: Text('${size}L'),
                      ),
                    )
                    .toList(),
                onChanged: stream.fixedSize
                    ? null
                    : (value) {
                        stream.binSize = value ?? '1100';
                        onChanged();
                      },
              ),
              NumberStepper(
                label: 'Collections / Week',
                value: stream.collectionsPerWeek,
                onChanged: (value) {
                  stream.collectionsPerWeek = value;
                  onChanged();
                },
              ),
              AppField(
                controller: stream.currentProvider,
                label: 'Current Supplier',
              ),
              AppField(
                controller: stream.currentCost,
                label: 'Current Monthly Cost',
                keyboardType: TextInputType.number,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            children: [
              FilterChip(
                label: const Text('Lock required'),
                selected: stream.lockRequired,
                onSelected: (value) {
                  stream.lockRequired = value;
                  onChanged();
                },
              ),
              FilterChip(
                label: const Text('Metal bin required'),
                selected: stream.metalBinRequired,
                onSelected: (value) {
                  stream.metalBinRequired = value;
                  onChanged();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class NumberStepper extends StatelessWidget {
  const NumberStepper({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(labelText: label),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: value <= 1 ? null : () => onChanged(value - 1),
            icon: const Icon(Icons.remove_circle_outline),
          ),
          Text(
            '$value',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          IconButton(
            onPressed: () => onChanged(value + 1),
            icon: const Icon(Icons.add_circle_outline),
          ),
        ],
      ),
    );
  }
}

class AppField extends StatelessWidget {
  const AppField({
    super.key,
    required this.controller,
    required this.label,
    this.required = false,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final bool required;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return StylusTextFormField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(labelText: required ? '$label *' : label),
      validator: required
          ? (value) =>
                (value ?? '').trim().isEmpty ? '$label is required.' : null
          : null,
    );
  }
}

class ResponsiveFields extends StatelessWidget {
  const ResponsiveFields({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width > 900
            ? 3
            : width > 620
            ? 2
            : 1;
        final itemWidth = (width - ((columns - 1) * 12)) / columns;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: children
              .map((child) => SizedBox(width: itemWidth, child: child))
              .toList(),
        );
      },
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: CardShell(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class CardShell extends StatelessWidget {
  const CardShell({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(22),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 14,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}

class StatCard extends StatelessWidget {
  const StatCard({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return CardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class HomeTile extends StatelessWidget {
  const HomeTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: CardShell(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 42, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: const TextStyle(
                color: Color(0xFF52607A),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class DisabledTile extends StatelessWidget {
  const DisabledTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.55,
      child: CardShell(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 42, color: Colors.blueGrey),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: const TextStyle(
                color: Color(0xFF52607A),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFF1E8FF),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Color(0xFF6D00E8),
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class ErrorBox extends StatelessWidget {
  const ErrorBox({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFE4E6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFFECDD3)),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: Color(0xFFBE123C),
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

String prettyStatus(String value) {
  if (value.isEmpty) return 'New';
  return value
      .replaceAll('_', ' ')
      .split(' ')
      .map(
        (word) => word.isEmpty
            ? word
            : '${word[0].toUpperCase()}${word.substring(1)}',
      )
      .join(' ');
}

String textValue(dynamic value) {
  if (value == null) return '0';
  if (value is num) return NumberFormat.decimalPattern('en_GB').format(value);
  final text = value.toString();
  return text.isEmpty ? '0' : text;
}

int intValue(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse((value ?? '').toString()) ?? 0;
}

Color wasteStreamColor(String label) {
  final key = label.toLowerCase();
  if (key.contains('mixed') || key.contains('dmr')) {
    return const Color(0xFF22C55E);
  }
  if (key.contains('card')) return const Color(0xFF2563EB);
  if (key.contains('glass')) return const Color(0xFF94A3B8);
  if (key.contains('food')) return const Color(0xFF92400E);
  if (key.contains('paper')) return const Color(0xFFE5E7EB);
  return const Color(0xFF0F172A);
}

String moneyValue(dynamic value) {
  if (value is num) return money(value.toDouble());
  final parsed = double.tryParse((value ?? '').toString());
  return money(parsed ?? 0);
}

String formatDate(String value) {
  final date = DateTime.tryParse(value);
  if (date == null) return value;
  return DateFormat('dd/MM/yyyy').format(date);
}

String money(double value) {
  return NumberFormat.currency(locale: 'en_GB', symbol: '£').format(value);
}
