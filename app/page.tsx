"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Database,
  ExternalLink,
  Gauge,
  Leaf,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Table2,
  Wind,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Credentials = {
  username: string;
  password: string;
};

type Row = Record<string, string | number | null>;
type ReportId = "stations" | "station-measurements" | "regional-pm" | "harmful-pm" | "optimal-so2" | "optimal-co";
type SectionId = ReportId | "powerbi";

const initialCredentials: Credentials = {
  username: "",
  password: "",
};
const defaultStationId = "20";
const colors = ["#267b5d", "#83b59c", "#dfaa51", "#74a9c3", "#ad8ac5", "#dd816c"];
const today = new Date();
const dateValue = (date: Date) => {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
};

const navGroups = [
  {
    title: "ОГЛЯД",
    items: [
      { id: "stations", label: "Станції моніторингу", icon: Radio },
      { id: "station-measurements", label: "Зведення вимірювань", icon: Table2 },
    ],
  },
  {
    title: "АНАЛІТИКА",
    items: [
      { id: "regional-pm", label: "PM за регіонами", icon: MapPin },
      { id: "harmful-pm", label: "Шкідливі PM2.5", icon: Wind },
      { id: "optimal-so2", label: "Діоксид сірки", icon: Activity },
      { id: "optimal-co", label: "Чадний газ", icon: Gauge },
      { id: "powerbi", label: "Power BI", icon: BarChart3 },
    ],
  },
] as const;

const titles: Record<SectionId, string> = {
  stations: "Станції моніторингу",
  "station-measurements": "Зведення вимірювань",
  "regional-pm": "PM за регіонами",
  "harmful-pm": "Шкідливі PM2.5",
  "optimal-so2": "Діоксид сірки",
  "optimal-co": "Чадний газ",
  powerbi: "Power BI",
};

function formatNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(number) : "—";
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(date);
}

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export default function Home() {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<{ database: string; username: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [section, setSection] = useState<SectionId>("stations");
  const [rows, setRows] = useState<Row[]>([]);
  const [stationOptions, setStationOptions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stationId, setStationId] = useState(defaultStationId);
  const [startDate, setStartDate] = useState("2019-01-01");
  const [endDate, setEndDate] = useState(() => dateValue(today));
  const [calculationType, setCalculationType] = useState("AQI (US)");
  const [embedUrl, setEmbedUrl] = useState(process.env.NEXT_PUBLIC_POWERBI_EMBED_URL ?? "");
  const [powerBiInput, setPowerBiInput] = useState(process.env.NEXT_PUBLIC_POWERBI_EMBED_URL ?? "");
  const [mobileNav, setMobileNav] = useState(false);

  const fetchReport = useCallback(async (report: ReportId, quiet = false) => {
    if (!connected) return;
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials,
          report,
          stationId: report === "station-measurements" || report === "harmful-pm" ? stationId : undefined,
          startDate: ["station-measurements", "regional-pm"].includes(report) ? startDate : undefined,
          endDate: ["station-measurements", "regional-pm"].includes(report) ? endDate : undefined,
          calculationType,
        }),
      });
      const result = (await response.json()) as { rows?: Row[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Помилка отримання даних.");
      setRows(result.rows ?? []);
      if (report === "stations") {
        const stationRows = result.rows ?? [];
        setStationOptions(stationRows);
        setStationId((currentStationId) =>
          stationRows.some((row) => String(row.station_id).trim() === currentStationId)
            ? currentStationId
            : stationRows.some((row) => String(row.station_id).trim() === defaultStationId)
              ? defaultStationId
              : String(stationRows[0]?.station_id ?? ""),
        );
        const latestDate = stationRows
          .map((row) => row.latest_measurement_date)
          .filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
          .sort()
          .at(-1);
        if (latestDate) {
          setEndDate(latestDate);
        }
      }
    } catch (requestError) {
      setRows([]);
      setError(requestError instanceof Error ? requestError.message : "Не вдалося отримати дані.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [calculationType, connected, credentials, endDate, startDate, stationId]);

  useEffect(() => {
    if (connected && section !== "powerbi") void fetchReport(section);
  }, [connected, fetchReport, section]);

  const connect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConnecting(true);
    setConnectionError("");
    try {
      const response = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const result = (await response.json()) as { connected?: boolean; database?: string; username?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не вдалося підключитися.");
      setConnection({ database: result.database ?? "PostgreSQL", username: result.username ?? credentials.username });
      setConnected(true);
    } catch (requestError) {
      setConnectionError(requestError instanceof Error ? requestError.message : "Помилка підключення.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setConnected(false);
    setConnection(null);
    setRows([]);
    setStationOptions([]);
    setCredentials((current) => ({ ...current, password: "" }));
    setSection("stations");
  };

  const applyPowerBiUrl = () => {
    try {
      const parsed = new URL(powerBiInput);
      if (parsed.protocol !== "https:" || parsed.hostname !== "app.powerbi.com") {
        throw new Error("Вкажіть HTTPS embed-посилання з app.powerbi.com.");
      }
      setEmbedUrl(parsed.toString());
    } catch (urlError) {
      setError(urlError instanceof Error ? urlError.message : "Некоректне посилання Power BI.");
    }
  };

  const visibleRows = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("uk");
    if (!normalized) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLocaleLowerCase("uk").includes(normalized)));
  }, [rows, search]);

  const currentTitle = titles[section];
  const setCredentialsField = (field: keyof Credentials, value: string | boolean) =>
    setCredentials((current) => ({ ...current, [field]: value }));
  const chooseSection = (id: SectionId) => {
    setSection(id);
    setRows([]);
    setError("");
    setSearch("");
    setMobileNav(false);
  };

  if (!connected) {
    return (
      <main className={styles.loginPage}>
        <div className={styles.loginDecor} />
        <section className={styles.loginCard}>
          <div className={styles.brandMark}><Leaf size={23} strokeWidth={2.4} /></div>
          <div className={styles.loginEyebrow}><span /> AIR QUALITY INTELLIGENCE</div>
          <h1>Чисті дані.<br /><span>Ясні рішення.</span></h1>
          <p className={styles.loginIntro}>Підключіться до PostgreSQL, щоб дослідити станції моніторингу та аналітику якості повітря.</p>
          <form onSubmit={connect} className={styles.connectForm}>
            <label>Логін
              <input value={credentials.username} onChange={(event) => setCredentialsField("username", event.target.value)} placeholder="З .env або введіть логін" autoComplete="username" />
            </label>
            <label>Пароль
              <input type="password" value={credentials.password} onChange={(event) => setCredentialsField("password", event.target.value)} placeholder="З .env або введіть пароль" autoComplete="current-password" />
            </label>
            {connectionError && <div className={styles.errorBox} role="alert">{connectionError}</div>}
            <button className={styles.connectButton} type="submit" disabled={connecting}>
              {connecting ? <LoaderCircle className={styles.spin} size={18} /> : <Database size={17} />}
              {connecting ? "Вхід…" : "Увійти до бази"}
            </button>
          </form>
          <div className={styles.secureNote}><ShieldCheck size={15} /> PGUSER / PGPASSWORD використовуються лише на сервері</div>
          <div className={styles.loginFooter}>AirScope <span>·</span> Система моніторингу довкілля</div>
        </section>
        <aside className={styles.loginAside}>
          <div className={styles.airOrb} aria-hidden="true"><div /><div /><div /><Wind size={56} /></div>
          <div className={styles.asideCopy}>
            <span className={styles.asideKicker}>МІСТО ДАНИХ · ЖИВИЙ ОГЛЯД</span>
            <h2>Повітря, яке<br />можна виміряти.</h2>
            <p>Єдина аналітична панель для станцій SaveEcoBot, КМДА та MQTT-моніторингу.</p>
            <div className={styles.asideStats}>
              <div><strong>01</strong><span>підключення до БД</span></div>
              <div><strong>04</strong><span>аналітичні звіти</span></div>
              <div><strong>BI</strong><span>Power BI embed</span></div>
            </div>
          </div>
          <span className={styles.asideFoot}>Дані про якість повітря · Україна</span>
        </aside>
      </main>
    );
  }

  return (
    <main className={styles.appShell}>
      {mobileNav && <button aria-label="Закрити меню" className={styles.mobileScrim} onClick={() => setMobileNav(false)} />}
      <aside className={`${styles.sidebar} ${mobileNav ? styles.sidebarOpen : ""}`}>
        <button className={styles.brand} onClick={() => chooseSection("stations")}>
          <span className={styles.brandMark}><Leaf size={21} strokeWidth={2.4} /></span>
          <span className={styles.brandName}>air<span>scope</span><small>ENVIRONMENT INTELLIGENCE</small></span>
        </button>
        <div className={styles.workspace}>
          <div className={styles.workspaceIcon}><Cloud size={17} /></div>
          <div><strong>Air quality network</strong><span>{connection?.database}</span></div>
          <ChevronDown size={15} />
        </div>
        <nav className={styles.navigation} aria-label="Основна навігація">
          {navGroups.map((group) => (
            <div className={styles.navGroup} key={group.title}>
              <div className={styles.navLabel}>{group.title}</div>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => chooseSection(id)} className={`${styles.navItem} ${section === id ? styles.navItemActive : ""}`}>
                  <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{section === id && <span className={styles.activeDot} />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.connectionBadge}><span /><div><strong>Базу підключено</strong><small>{connection?.username} · PostgreSQL</small></div></div>
          <button className={styles.navItem} onClick={disconnect}><LogOut size={17} /><span>Відключитися</span></button>
          <div className={styles.sidebarVersion}>AirScope Dashboard <span>v1.0</span></div>
        </div>
      </aside>

      <section className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><button className={styles.mobileMenu} aria-label="Відкрити меню" onClick={() => setMobileNav(true)}><Menu size={20} /></button><span>Робочий простір</span><span className={styles.crumbSlash}>/</span><strong>{currentTitle}</strong></div>
          <div className={styles.topActions}>
            <div className={styles.livePill}><span /> LIVE DATA</div>
            <button className={styles.iconButton} aria-label="Допомога" title="Довідка"><CircleHelp size={18} /></button>
            <button className={styles.userAvatar} title={`Користувач ${connection?.username}`}>{connection?.username?.slice(0, 1).toUpperCase() ?? "U"}</button>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.pageHeading}>
            <div>
              <div className={styles.kicker}>АНАЛІТИЧНИЙ ЦЕНТР <span>·</span> {new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" }).format(today).toUpperCase()}</div>
              <h1>{currentTitle}</h1>
              <p>{section === "stations" ? "Мережа станцій та доступні параметри якості повітря." : section === "powerbi" ? "Інтерактивні звіти Microsoft Power BI у вашому робочому просторі." : "Аналіз вимірювань на основі даних вашої бази PostgreSQL."}</p>
            </div>
            <button className={styles.refreshButton} onClick={() => section === "powerbi" ? setError("") : void fetchReport(section)} disabled={loading || section === "powerbi"}>
              <RefreshCw size={15} className={loading ? styles.spin : ""} /> Оновити дані
            </button>
          </div>

          <div className={styles.metricGrid}>
            <MetricCard icon={<Radio size={18} />} label="Станції в мережі" value={section === "stations" ? formatNumber(rows.length) : "—"} change={section === "stations" ? "Всього зареєстровано" : "Оберіть огляд станцій"} tone="green" />
            <MetricCard icon={<Activity size={18} />} label="Вимірювання у звіті" value={section === "station-measurements" ? formatNumber(rows.reduce((total, row) => total + Number(row.measurements_count ?? 0), 0)) : "—"} change={section === "station-measurements" ? "За обраний період" : "Вибірка за фільтрами"} tone="blue" />
            <MetricCard icon={<Wind size={18} />} label="Показники повітря" value={section === "stations" ? formatNumber(new Set(rows.flatMap((row) => String(row.parameters ?? "").split(", ").filter(Boolean))).size) : "—"} change="PM2.5 · PM10 · SO₂ · CO" tone="amber" />
            <MetricCard icon={<Sparkles size={18} />} label="Джерело даних" value="PostgreSQL" change={connection?.database ?? "—"} tone="purple" />
          </div>

          {section !== "powerbi" && (
            <div className={styles.filterBar}>
              <div className={styles.filterTitle}><Settings2 size={16} /><strong>Параметри звіту</strong></div>
              {(section === "station-measurements" || section === "regional-pm") && <DateFilters startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} />}
              {(section === "station-measurements" || section === "harmful-pm") && (
                <StationSelect rows={stationOptions} value={stationId} onChange={setStationId} />
              )}
              {["harmful-pm", "optimal-so2", "optimal-co"].includes(section) && <CalculationSelect value={calculationType} onChange={setCalculationType} />}
              <div className={styles.filterActions}>
                <button className={styles.applyButton} onClick={() => void fetchReport(section)} disabled={loading}><Search size={14} /> Застосувати</button>
              </div>
            </div>
          )}

          {section === "powerbi" ? (
            <PowerBiPanel url={embedUrl} input={powerBiInput} onInput={setPowerBiInput} onApply={applyPowerBiUrl} error={error} />
          ) : (
            <ReportContent
              section={section}
              rows={visibleRows}
              allRows={rows}
              loading={loading}
              error={error}
              search={search}
              setSearch={setSearch}
              onSelectStation={setStationId}
              onChooseSection={chooseSection}
              onRetry={() => void fetchReport(section)}
            />
          )}
          <footer className={styles.pageFooter}><span>© {today.getFullYear()} AirScope Analytics</span><span><ShieldCheck size={13} /> Захищене read-only підключення</span><span>Powered by PostgreSQL &amp; Power BI</span></footer>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value, change, tone }: { icon: React.ReactNode; label: string; value: string; change: string; tone: string }) {
  return <article className={styles.metricCard}><div className={`${styles.metricIcon} ${styles[`tone_${tone}`]}`}>{icon}</div><span className={styles.metricLabel}>{label}</span><strong className={styles.metricValue}>{value}</strong><span className={styles.metricChange}>{change}</span></article>;
}

function DateFilters({ startDate, endDate, onStart, onEnd }: { startDate: string; endDate: string; onStart: (value: string) => void; onEnd: (value: string) => void }) {
  return <div className={styles.dateFields}><label><CalendarDays size={14} /><span>Від</span><input type="date" value={startDate} onChange={(event) => onStart(event.target.value)} /></label><span className={styles.dateDash}>—</span><label><span>До</span><input type="date" value={endDate} onChange={(event) => onEnd(event.target.value)} /></label></div>;
}

function StationSelect({ rows, value, onChange }: { rows: Row[]; value: string; onChange: (value: string) => void }) {
  return <label className={styles.selectField}><MapPin size={14} /><span>Станція</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Оберіть станцію</option>{rows.map((row) => <option key={String(row.station_id)} value={String(row.station_id)}>{row.city ? `${row.city} · ` : ""}{row.station_id}</option>)}</select></label>;
}

function CalculationSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className={styles.selectField}><Gauge size={14} /><span>Індекс</span><select value={value} onChange={(event) => onChange(event.target.value)}><option>AQI (US)</option><option>CAQI (EU)</option><option>EAQI (EU)</option></select></label>;
}

function ReportContent({
  section, rows, allRows, loading, error, search, setSearch, onSelectStation, onChooseSection, onRetry,
}: {
  section: ReportId;
  rows: Row[];
  allRows: Row[];
  loading: boolean;
  error: string;
  search: string;
  setSearch: (value: string) => void;
  onSelectStation: (value: string) => void;
  onChooseSection: (section: SectionId) => void;
  onRetry: () => void;
}) {
  if (loading) return <div className={styles.stateCard}><LoaderCircle className={styles.spin} size={28} /><strong>Завантажуємо аналітику</strong><span>Безпечно отримуємо актуальні дані з PostgreSQL…</span></div>;
  if (error) return <div className={`${styles.stateCard} ${styles.stateError}`} role="alert"><div className={styles.stateIcon}><X size={20} /></div><strong>Не вдалося отримати дані</strong><span>{error}</span><button onClick={onRetry}>Спробувати ще раз</button></div>;
  if (section === "stations") return <StationsReport rows={rows} search={search} onSearch={setSearch} onSelectStation={onSelectStation} onChooseSection={onChooseSection} />;
  if (section === "station-measurements") return <MeasurementReport rows={rows} search={search} onSearch={setSearch} />;
  if (section === "regional-pm") return <RegionalReport rows={rows} />;
  if (section === "harmful-pm") return <HarmfulReport rows={rows} stationCount={allRows.length} />;
  return <OptimalReport rows={rows} pollutant={section === "optimal-so2" ? "SO₂" : "CO"} />;
}

function StationsReport({ rows, search, onSearch, onSelectStation, onChooseSection }: {
  rows: Row[];
  search: string;
  onSearch: (value: string) => void;
  onSelectStation: (value: string) => void;
  onChooseSection: (section: SectionId) => void;
}) {
  return <section className={styles.reportPanel}>
    <div className={styles.panelHeader}><div><div className={styles.panelEyebrow}>МЕРЕЖА МОНІТОРИНГУ</div><h2>Підключені станції</h2><p>Початок роботи оцінено за першим зафіксованим вимірюванням.</p></div><div className={styles.panelTools}><span className={styles.rowCount}>{rows.length} станцій</span><SearchBox value={search} onChange={onSearch} /></div></div>
    <div className={styles.tableWrap}><table><thead><tr><th>СТАНЦІЯ</th><th>МІСТО</th><th>ДЖЕРЕЛО</th><th>ПІДКЛЮЧЕНА ВІД*</th><th>ПАРАМЕТРИ</th><th>СТАТУС</th><th /></tr></thead><tbody>
      {rows.map((row) => <tr key={String(row.station_id)}><td><span className={styles.stationCode}><span className={styles.stationDot} />{row.source_identifier ? display(row.source_identifier) : `Станція ${display(row.station_id)}`}</span><small className={styles.tableSub}>{display(row.station_id)}</small></td><td>{display(row.city)}</td><td><span className={styles.sourcePill}>{display(row.source_type)}</span></td><td>{formatDate(row.connected_since)}</td><td><div className={styles.parameterList}>{String(row.parameters ?? "").split(", ").filter(Boolean).map((parameter) => <span key={parameter}>{parameter}</span>)}{!row.parameters && "—"}</div></td><td><span className={`${styles.statusPill} ${String(row.status).toLowerCase() === "active" ? styles.statusActive : styles.statusInactive}`}><span />{display(row.status)}</span></td><td><button className={styles.rowArrow} aria-label="Відкрити звіт станції" onClick={() => { onSelectStation(String(row.station_id)); onChooseSection("station-measurements"); }}>↗</button></td></tr>)}
    </tbody></table>{rows.length === 0 && <EmptyTable message="Станцій не знайдено. Перевірте, чи заповнені таблиці station та measurement." />}</div>
    <div className={styles.panelFoot}><span>* Схема БД не містить дати підключення: показано дату першого вимірювання.</span><span>Джерело: station · measurement · station_measured_unit</span></div>
  </section>;
}

function MeasurementReport({ rows, search, onSearch }: { rows: Row[]; search: string; onSearch: (value: string) => void }) {
  return <section className={styles.reportPanel}>
    <div className={styles.panelHeader}><div><div className={styles.panelEyebrow}>СТАТИСТИКА СТАНЦІЇ</div><h2>Параметри за період</h2><p>Мінімум, максимум і середнє значення для кожного вимірюваного параметра.</p></div><div className={styles.panelTools}><span className={styles.rowCount}>{rows.length} параметрів</span><SearchBox value={search} onChange={onSearch} /></div></div>
    <div className={styles.tableWrap}><table><thead><tr><th>ПАРАМЕТР</th><th>ВИМІРЮВАНЬ</th><th>МІНІМУМ</th><th>СЕРЕДНЄ</th><th>МАКСИМУМ</th><th>ОДИНИЦЯ</th></tr></thead><tbody>
      {rows.map((row) => <tr key={String(row.parameter_name)}><td><span className={styles.parameterName}><span className={styles.paramIcon}><Activity size={14} /></span>{display(row.parameter_name)}</span></td><td>{formatNumber(row.measurements_count)}</td><td>{formatNumber(row.min_value)}</td><td><strong>{formatNumber(row.avg_value)}</strong></td><td>{formatNumber(row.max_value)}</td><td>{display(row.unit)}</td></tr>)}
    </tbody></table>{rows.length === 0 && <EmptyTable message="Для цієї станції й періоду вимірювань немає. Оберіть станцію та період у фільтрах." />}</div>
    <div className={styles.panelFoot}><span>Агрегація виконується на сервері бази даних.</span><span>AVG, MIN, MAX · PostgreSQL</span></div>
  </section>;
}

function RegionalReport({ rows }: { rows: Row[] }) {
  const chartData = useMemo(() => {
    const regions = new Map<string, { region: string; "PM2.5": number | null; PM10: number | null; unit: string }>();
    rows.forEach((row) => {
      const name = String(row.region);
      const item = regions.get(name) ?? { region: name, "PM2.5": null, PM10: null, unit: String(row.unit ?? "") };
      item[String(row.parameter) as "PM2.5" | "PM10"] = Number(row.max_value);
      regions.set(name, item);
    });
    return Array.from(regions.values());
  }, [rows]);
  return <><div className={styles.chartGrid}><ChartPanel eyebrow="ПОРІВНЯННЯ РЕГІОНІВ" title="Максимальні значення частинок" description="Найвище зафіксоване значення у вказаному періоді." className={styles.wideChart}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid stroke="#edf1ee" vertical={false} /><XAxis dataKey="region" tickLine={false} axisLine={false} tick={{ fill: "#85928b", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#85928b", fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} /><Bar dataKey="PM2.5" fill="#247457" radius={[5, 5, 0, 0]} maxBarSize={42} /><Bar dataKey="PM10" fill="#93bea8" radius={[5, 5, 0, 0]} maxBarSize={42} /></BarChart></ResponsiveContainer>
    </ChartPanel><div className={styles.infoCard}><span className={styles.infoIcon}><MapPin size={19} /></span><span className={styles.panelEyebrow}>ГЕОГРАФІЧНИЙ ЗРІЗ</span><strong>{chartData.length || 0}</strong><span>регіонів у вибірці</span><div className={styles.infoNote}><CircleHelp size={14} /> Якщо в таблиці немає стовпця region, звіт групує дані за містом.</div></div></div>
    <DataTable title="Максимуми частинок у розрізі регіонів" columns={[["region", "РЕГІОН"], ["parameter", "ПАРАМЕТР"], ["max_value", "МАКС. ЗНАЧЕННЯ"], ["unit", "ОДИНИЦЯ"]]} rows={rows} /></>;
}

function HarmfulReport({ rows, stationCount }: { rows: Row[]; stationCount: number }) {
  const data = rows.map((row) => ({ date: formatDate(row.measurement_date), value: Number(row.daily_mean), category: row.harmful_categories }));
  return <><div className={styles.chartGrid}><ChartPanel eyebrow="СЕРЕДНЬОДОБОВІ ЗНАЧЕННЯ" title="Дні з підвищеним PM2.5" description="Кількість днів, коли середнє значення перетнуло шкідливий поріг.">
      {data.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke="#edf1ee" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#85928b", fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#85928b", fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" name="Середньодобове PM2.5" fill="#df875a" radius={[5, 5, 0, 0]} maxBarSize={35} /></BarChart></ResponsiveContainer> : <ChartEmpty message={stationCount ? "Оберіть станцію, щоб переглянути вимірювання." : "За обраною станцією шкідливих середньодобових значень не знайдено."} />}
    </ChartPanel><div className={styles.infoCard}><span className={`${styles.infoIcon} ${styles.infoIconAmber}`}><Wind size={20} /></span><span className={styles.panelEyebrow}>ШКІДЛИВИХ ДНІВ</span><strong>{rows.length}</strong><span>за весь час спостережень</span><div className={styles.infoNote}><CircleHelp size={14} /> Пороги беруться з BreakPoint: категорії Poor, Very Poor, Severe.</div></div></div>
    <DataTable title="Середньодобові значення PM2.5 у шкідливому діапазоні" columns={[["measurement_date", "ДАТА"], ["daily_mean", "СЕРЕДНЄ ЗА ДОБУ"], ["harmful_categories", "КАТЕГОРІЯ"], ["unit", "ОДИНИЦЯ"]]} rows={rows} dateColumns={["measurement_date"]} /></>;
}

function OptimalReport({ rows, pollutant }: { rows: Row[]; pollutant: string }) {
  const data = rows.map((row) => ({ ...row, category: String(row.category), measurements_count: Number(row.measurements_count) }));
  const total = data.reduce((sum, row) => sum + row.measurements_count, 0);
  return <><div className={styles.chartGrid}><ChartPanel eyebrow="ОПТИМАЛЬНИЙ ДІАПАЗОН" title={`Вимірювання ${pollutant} у нормі`} description="Кількість значень у категоріях Excellent та Fine за налаштованими порогами.">
      {data.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="measurements_count" nameKey="category" cx="50%" cy="48%" innerRadius={72} outerRadius={111} paddingAngle={4} stroke="none">{data.map((row, index) => <Cell key={row.category} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer> : <ChartEmpty message="Для цього параметра немає вимірювань у налаштованому оптимальному діапазоні." />}
    </ChartPanel><div className={styles.infoCard}><span className={styles.infoIcon}><Gauge size={19} /></span><span className={styles.panelEyebrow}>В ОПТИМАЛЬНОМУ ДІАПАЗОНІ</span><strong>{formatNumber(total)}</strong><span>вимірювань {pollutant}</span><div className={styles.infoNote}><CircleHelp size={14} /> Розрахунок за категоріями Excellent і Fine та обраною системою AQI.</div></div></div>
    <DataTable title={`Кількість оптимальних вимірювань ${pollutant}`} columns={[["parameter_name", "ПАРАМЕТР"], ["category", "КАТЕГОРІЯ"], ["measurements_count", "КІЛЬКІСТЬ"], ["unit", "ОДИНИЦЯ"]]} rows={rows} /></>;
}

const tooltipStyle = { borderRadius: 11, border: "1px solid #e8ece8", boxShadow: "0 10px 28px rgba(25,55,39,.08)", fontSize: 12 };

function ChartPanel({ eyebrow, title, description, children, className }: { eyebrow: string; title: string; description: string; children: React.ReactNode; className?: string }) {
  return <section className={`${styles.chartPanel} ${className ?? ""}`}><div className={styles.chartHeader}><div><span className={styles.panelEyebrow}>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><button className={styles.chartMore} aria-label="Детальніше"><ChevronDown size={17} /></button></div><div className={styles.chartArea}>{children}</div></section>;
}

function ChartEmpty({ message }: { message: string }) {
  return <div className={styles.chartEmpty}><BarChart3 size={24} /><span>{message}</span></div>;
}

function DataTable({ title, columns, rows, dateColumns = [] }: { title: string; columns: [string, string][]; rows: Row[]; dateColumns?: string[] }) {
  return <section className={styles.reportPanel}><div className={styles.panelHeader}><div><div className={styles.panelEyebrow}>ДЕТАЛЬНІ ДАНІ</div><h2>{title}</h2><p>Табличне представлення результатів за активними фільтрами.</p></div><span className={styles.rowCount}>{rows.length} рядків</span></div><div className={styles.tableWrap}><table><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(([key]) => <td key={key}>{dateColumns.includes(key) ? formatDate(row[key]) : key.includes("value") || key.includes("count") ? formatNumber(row[key]) : display(row[key])}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <EmptyTable message="За обраними параметрами даних не знайдено." />}</div><div className={styles.panelFoot}><span>Побудовано з актуальних вимірювань і порогів BreakPoint.</span><span>Таблиця · {rows.length} записів</span></div></section>;
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className={styles.searchBox}><Search size={15} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Пошук…" /><kbd>⌘ K</kbd></label>;
}

function EmptyTable({ message }: { message: string }) {
  return <div className={styles.emptyTable}><span><Table2 size={20} /></span><strong>Тут поки порожньо</strong><small>{message}</small></div>;
}

function PowerBiPanel({ url, input, onInput, onApply, error }: { url: string; input: string; onInput: (value: string) => void; onApply: () => void; error: string }) {
  return <section className={styles.powerBiSection}>
    <div className={styles.powerBiIntro}><div className={styles.powerBiIcon}><BarChart3 size={22} /></div><div><span className={styles.panelEyebrow}>MICROSOFT POWER BI EMBED</span><h2>Інтерактивна аналітика</h2><p>Вбудуйте звіт Power BI у панель AirScope або відкрийте його в окремій вкладці.</p></div></div>
    <div className={styles.embedForm}><label htmlFor="powerbi-url">Embed URL звіту</label><div><input id="powerbi-url" value={input} onChange={(event) => onInput(event.target.value)} placeholder="https://app.powerbi.com/view?r=..." /><button onClick={onApply}><Check size={15} /> Підключити звіт</button></div><small>Підтримується HTTPS-посилання з домену app.powerbi.com — наприклад, Power BI Embedded або Publish to web.</small></div>
    {error && <div className={styles.errorBox} role="alert">{error}</div>}
    {url ? <div className={styles.embedFrameWrap}><div className={styles.embedToolbar}><span><span className={styles.statusGreen} /> ЗВІТ POWER BI</span><a href={url} target="_blank" rel="noreferrer">Відкрити в Power BI <ExternalLink size={14} /></a></div><iframe className={styles.embedFrame} src={url} title="Power BI звіт з моніторингу повітря" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div> : <div className={styles.embedPlaceholder}><div className={styles.placeholderGraphic}><BarChart3 size={34} /><div /><div /><div /><div /></div><h3>Ваш звіт скоро з’явиться тут</h3><p>Вставте Power BI embed-посилання вище, щоб переглядати дашборди безпосередньо в AirScope.</p><div className={styles.embedSteps}><span><i>01</i> Відкрийте звіт у Power BI</span><span><i>02</i> Оберіть «Вбудувати звіт»</span><span><i>03</i> Скопіюйте посилання</span></div></div>}
    <div className={styles.powerBiNotice}><ShieldCheck size={16} /><div><strong>Безпечне вбудовування</strong><span>Для приватних звітів налаштуйте Microsoft Entra ID та Power BI Embedded на стороні Power BI. Не використовуйте «Publish to web» для конфіденційних даних.</span></div></div>
  </section>;
}
