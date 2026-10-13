# AirScope — аналітика якості повітря

Next.js dashboard для PostgreSQL із таблицями, графіками, фільтрами та вбудованими звітами Microsoft Power BI. Інтерфейс українською, стилі винесені в CSS Modules.

SQL-запити винесені в папку `queries/`: [queries/reports.ts](./queries/reports.ts) містить запити звітів, [queries/connection.ts](./queries/connection.ts) — запит перевірки підключення та read-only транзакції.

Для швидшого отримання звітів один раз виконайте команди з [queries/indexes.sql](./queries/indexes.sql) у цільовій БД. Кожен `CREATE INDEX CONCURRENTLY` слід запускати окремою командою поза явною транзакцією.

## Запуск

Потрібні Node.js 20.9+ і доступ до PostgreSQL.

```bash
npm install
npm run dev
```

Скопіюйте `.env.example` до `.env` і задайте параметри PostgreSQL у `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE` та `PGCHANNELBINDING`. Стандартні `PG*` параметри мають пріоритет; для сумісності підтримуються `DB_HOST`, `DB_PORT`, `DB_NAME` та `DB_SSL`. Для Neon використовуйте TLS, наприклад `PGSSLMODE=require` і `PGCHANNELBINDING=require`. Відкрийте http://localhost:3000: якщо `PGUSER`/`PGPASSWORD` задані, їх використовує тільки сервер; поля входу можна залишити порожніми. Якщо вони не задані, введіть логін і пароль PostgreSQL у форму. Серверне з’єднання дозволяє лише читання.

Приклад `.env.local`:

```dotenv
PGHOST=db.example.com
PGPORT=5432
PGDATABASE=air_quality
PGUSER=airscope_user
PGPASSWORD=your-database-password
PGSSLMODE=require
PGCHANNELBINDING=require
```

Не комітьте `.env` і не надсилайте його в чат: файл уже виключений із Git через `.gitignore`. У production використовуйте TLS для сайту й окремі облікові записи БД лише з правами `SELECT`.

## Звіти

- **Станції моніторингу** — джерело, статус, параметри й дата першого вимірювання (у схемі немає окремої дати підключення).
- **Зведення вимірювань** — мінімум, максимум, середнє та кількість за обраною станцією/періодом.
- **PM за регіонами** — максимуми PM2.5 та PM10 за період. Якщо у `station` або `station_address` є поле `region`, воно використовується; у наданій схемі його немає, тому запасне групування йде за `city`.
- **Шкідливі PM2.5** — кількість/перелік дат, коли середньодобове середнє потрапляє в пороги `Poor`, `Very Poor` або `Severe` для `24-hr` у таблиці `BreakPoint`.
- **SO₂ та CO** — кількість вимірювань у `Excellent`/`Fine` за порогами `Current` із `BreakPoint`.

Для категоріальних звітів обирається `AQI (US)`, `CAQI (EU)` або `EAQI (EU)`. Щоб результати відображали потрібні стандарти, заповніть у `BreakPoint` відповідні межі, періоди, категорії та одиниці вимірювання. Визначення PM/SO₂/CO спирається на `Measured_Unit.Code` і `Measured_Unit.Name`.

### Відмінності схеми

Скрипт схеми в запиті містить `VARCHAR(MAX)`, що не підтримується PostgreSQL. Для запуску на PostgreSQL замініть його на `TEXT` або `VARCHAR` без параметра. Для звіту «PM за регіонами» додайте колонку `region` до `station` чи `station_address`, якщо потрібен саме обласний, а не міський зріз.

## Power BI

Перейдіть до **Power BI** і вставте HTTPS embed URL із `app.powerbi.com`. Щоб URL з’являвся автоматично, задайте `NEXT_PUBLIC_POWERBI_EMBED_URL` у `.env.local`. Доступ до вбудованого звіту визначається налаштуваннями Microsoft Power BI. Для приватних звітів використовуйте автентифікацію Microsoft Entra ID/Power BI Embedded; не вмикайте **Publish to web** для непублічних даних.

## Перевірки

```bash
npm run lint
npm run build
```
