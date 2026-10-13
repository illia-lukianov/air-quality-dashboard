-- Run this once in the PostgreSQL database used by AirScope.
-- The index supports fast first/last measurement lookups per station.
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS measurement_station_created_at_idx
--   ON measurement (id_station, created_at);

-- Supports pollutant report filtering by measured unit.
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS measurement_measured_unit_idx
--   ON measurement (id_measured_unit);
npg_yDHtk0v4qabz