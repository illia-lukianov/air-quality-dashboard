import type { Client } from "pg";

export type ReportRequest = {
  report: string;
  stationId?: string;
  startDate?: string;
  endDate?: string;
  calculationType?: string;
};

const validDate = (value: string | undefined): value is string =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

function requirePeriod(input: ReportRequest) {
  if (!validDate(input.startDate) || !validDate(input.endDate)) {
    throw new Error("Вкажіть коректний початок і кінець періоду.");
  }
  if (input.startDate > input.endDate) {
    throw new Error("Початок періоду має бути не пізніше за його кінець.");
  }
  return [input.startDate, input.endDate];
}

function requireStation(input: ReportRequest) {
  if (!input.stationId || input.stationId.length > 10) {
    throw new Error("Оберіть станцію зі списку.");
  }
  return input.stationId;
}

function calculationType(input: ReportRequest) {
  const allowed = ["AQI (US)", "CAQI (EU)", "EAQI (EU)"];
  const selected = input.calculationType ?? "AQI (US)";
  if (!allowed.includes(selected)) {
    throw new Error("Оберіть підтримувану систему розрахунку.");
  }
  return selected;
}

export async function runReport(client: Client, input: ReportRequest) {
  switch (input.report) {
    case "stations": {
      const result = await client.query(`
        SELECT
          s.id_station AS station_id,
          s.city,
          s.status::text AS status,
          s.source_type::text AS source_type,
          COALESCE(k.identifier, seb.identifier, ms.url) AS source_identifier,
          measurements.connected_since,
          measurements.latest_measurement_date,
          parameters.available_parameters AS parameters
        FROM station s
        LEFT JOIN LATERAL (
          SELECT
            MIN(m.created_at) AS connected_since,
            MAX(m.created_at)::date AS latest_measurement_date
          FROM measurement m
          WHERE m.id_station = s.id_station
        ) measurements ON true
        LEFT JOIN LATERAL (
          SELECT STRING_AGG(mu.name, ', ' ORDER BY mu.name) AS available_parameters
          FROM station_measured_unit smu
          JOIN measured_unit mu ON mu.id_measured_unit = smu.id_measured_unit
          WHERE smu.id_station = s.id_station
        ) parameters ON true
        LEFT JOIN kmda_station k ON k.id_station = s.id_station
        LEFT JOIN saveecobot_station seb ON seb.id_station = s.id_station
        LEFT JOIN mqtt_server ms ON ms.id_station = s.id_station
        ORDER BY s.city NULLS LAST, s.id_station
      `);
      return result.rows;
    }

    case "station-measurements": {
      const stationId = requireStation(input);
      const [startDate, endDate] = requirePeriod(input);
      const result = await client.query(
        `
          SELECT
            mu.name AS parameter_name,
            mu.unit,
            COUNT(m.value)::int AS measurements_count,
            MIN(m.value) AS min_value,
            MAX(m.value) AS max_value,
            ROUND(AVG(m.value), 2) AS avg_value
          FROM measurement m
          JOIN measured_unit mu ON mu.id_measured_unit = m.id_measured_unit
          WHERE m.id_station = $1
            AND m.created_at >= $2::date
            AND m.created_at < ($3::date + INTERVAL '1 day')
          GROUP BY mu.id_measured_unit, mu.name, mu.unit
          ORDER BY mu.name
        `,
        [stationId, startDate, endDate],
      );
      return result.rows;
    }

    case "regional-pm": {
      const [startDate, endDate] = requirePeriod(input);
      const result = await client.query(
        `
          SELECT
            COALESCE(
              NULLIF(to_jsonb(s)->>'region', ''),
              NULLIF(to_jsonb(sa)->>'region', ''),
              NULLIF(s.city, ''),
              NULLIF(sa.address, ''),
              'Невідомий регіон'
            ) AS region,
            CASE
              WHEN lower(concat_ws(' ', mu.code, mu.name)) ~ 'pm[ ._-]*2[ ._-]*5|pm[ ._-]*25' THEN 'PM2.5'
              ELSE 'PM10'
            END AS parameter,
            MAX(m.value) AS max_value,
            mu.unit
          FROM measurement m
          JOIN station s ON s.id_station = m.id_station
          LEFT JOIN station_address sa ON sa.id_station = s.id_station
          JOIN measured_unit mu ON mu.id_measured_unit = m.id_measured_unit
          WHERE m.created_at >= $1::date
            AND m.created_at < ($2::date + INTERVAL '1 day')
            AND lower(concat_ws(' ', mu.code, mu.name)) ~ 'pm[ ._-]*2[ ._-]*5|pm[ ._-]*25|pm[ ._-]*10'
          GROUP BY 1, 2, 4
          ORDER BY 1, 2
        `,
        [startDate, endDate],
      );
      return result.rows;
    }

    case "harmful-pm": {
      const stationId = requireStation(input);
      const result = await client.query(
        `
          WITH daily_means AS (
            SELECT
              m.id_measured_unit,
              mu.name AS parameter_name,
              mu.unit,
              m.created_at::date AS measurement_date,
              AVG(m.value) AS daily_mean
            FROM measurement m
            JOIN measured_unit mu ON mu.id_measured_unit = m.id_measured_unit
            WHERE m.id_station = $1
              AND lower(concat_ws(' ', mu.code, mu.name)) ~ 'pm[ ._-]*2[ ._-]*5|pm[ ._-]*25'
            GROUP BY m.id_measured_unit, mu.name, mu.unit, m.created_at::date
          )
          SELECT
            d.measurement_date,
            d.parameter_name,
            d.unit,
            ROUND(d.daily_mean, 2) AS daily_mean,
            STRING_AGG(DISTINCT bp.category::text, ', ' ORDER BY bp.category::text) AS harmful_categories
          FROM daily_means d
          JOIN breakpoint bp ON bp.id_measured_unit = d.id_measured_unit
          WHERE bp.time_period::text = '24-hr'
            AND bp.calculation_type::text = $2
            AND bp.category::text IN ('Poor', 'Very Poor', 'Severe')
            AND d.daily_mean >= bp.bottom
            AND d.daily_mean <= bp.upper
          GROUP BY d.measurement_date, d.parameter_name, d.unit, d.daily_mean
          ORDER BY d.measurement_date
        `,
        [stationId, calculationType(input)],
      );
      return result.rows;
    }

    case "optimal-so2":
    case "optimal-co": {
      const wanted = input.report === "optimal-so2"
        ? "(^|[^a-z0-9])so2([^a-z0-9]|$)|sul(ph|f)ur dioxide|сірк"
        : "(^|[^a-z0-9])co([^a-z0-9]|$)|carbon monoxide|чадн";
      const period = input.report === "optimal-so2" ? "1-hr" : "8-hr";
      const result = await client.query(
        `
          WITH selected_breakpoints AS (
            SELECT candidate.*
            FROM breakpoint candidate
            WHERE candidate.calculation_type::text = $2
              AND (
                candidate.time_period::text = $3
                OR (
                  candidate.time_period::text = 'Current'
                  AND NOT EXISTS (
                    SELECT 1
                    FROM breakpoint specific_period
                    WHERE specific_period.id_measured_unit = candidate.id_measured_unit
                      AND specific_period.calculation_type::text = $2
                      AND specific_period.time_period::text = $3
                  )
                )
              )
          )
          SELECT
            mu.name AS parameter_name,
            mu.unit,
            bp.category::text AS category,
            COUNT(DISTINCT m.id_measurement)::int AS measurements_count
          FROM measurement m
          JOIN measured_unit mu ON mu.id_measured_unit = m.id_measured_unit
          JOIN selected_breakpoints bp ON bp.id_measured_unit = m.id_measured_unit
          WHERE regexp_replace(
                  lower(concat_ws(' ', mu.code, mu.name)),
                  '[₂₁₀.]',
                  '',
                  'g'
                ) ~ $1
            AND bp.category::text IN ('Excellent', 'Fine')
            AND m.value >= bp.bottom
            AND m.value <= bp.upper
          GROUP BY mu.name, mu.unit, bp.category
          ORDER BY bp.category::text
        `,
        [wanted, calculationType(input), period],
      );
      return result.rows;
    }

    default:
      throw new Error("Невідомий тип звіту.");
  }
}
