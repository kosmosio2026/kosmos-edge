-- ============================
-- SENSIO ENVIRONMENTAL SENSOR
-- ============================

CREATE TABLE IF NOT EXISTS sensio_env_data (
    id SERIAL PRIMARY KEY,
    dev_eui TEXT NOT NULL,
    gateway_id TEXT NOT NULL,
    time TIMESTAMPTZ NOT NULL,
    dr INT NOT NULL,
    fcnt INT NOT NULL,
    fport INT NOT NULL,
    rssi INT NOT NULL,
    snr DOUBLE PRECISION NOT NULL,
    channel INT NOT NULL,

    temperature_c DOUBLE PRECISION NOT NULL,
    humidity_percent INT NOT NULL,
    pm1_0_ug_m3 DOUBLE PRECISION NOT NULL,
    pm2_5_ug_m3 DOUBLE PRECISION NOT NULL,
    pm10_ug_m3 DOUBLE PRECISION NOT NULL,

    battery_state INT NOT NULL,
    comm_env_ok BOOLEAN NOT NULL,
    device_ok BOOLEAN NOT NULL,
    sensor_ok BOOLEAN NOT NULL
);

-- Notify trigger
CREATE OR REPLACE FUNCTION notify_sensio() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('sensio_update', '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sensio_trigger ON sensio_env_data;
CREATE TRIGGER sensio_trigger
AFTER INSERT ON sensio_env_data
FOR EACH ROW EXECUTE FUNCTION notify_sensio();


-- ============================
-- KOSMOS PARKING SENSOR
-- ============================

CREATE TABLE IF NOT EXISTS parking_sensor_data (
    id SERIAL PRIMARY KEY,
    dev_eui TEXT NOT NULL,
    gateway_id TEXT NOT NULL,
    time TIMESTAMPTZ NOT NULL,
    dr INT NOT NULL,
    fcnt INT NOT NULL,
    fport INT NOT NULL,
    rssi INT NOT NULL,
    snr DOUBLE PRECISION NOT NULL,
    channel INT NOT NULL,

    battery_status INT NOT NULL,
    device_status INT NOT NULL,
    parking_status INT NOT NULL,
    firmware_version INT NOT NULL
);

-- Notify trigger
CREATE OR REPLACE FUNCTION notify_parking() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('parking_update', '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parking_trigger ON parking_sensor_data;
CREATE TRIGGER parking_trigger
AFTER INSERT ON parking_sensor_data
FOR EACH ROW EXECUTE FUNCTION notify_parking();


-- ============================
-- KOSMOS TRACKER
-- ============================

CREATE TABLE IF NOT EXISTS kosmos_tracker_data (
    id SERIAL PRIMARY KEY,
    dev_eui TEXT NOT NULL,
    gateway_id TEXT NOT NULL,
    time TIMESTAMPTZ NOT NULL,
    dr INT NOT NULL,
    fcnt INT NOT NULL,
    fport INT NOT NULL,
    rssi INT NOT NULL,
    snr DOUBLE PRECISION NOT NULL,
    channel INT NOT NULL,

    battery_status INT NOT NULL,
    device_status INT NOT NULL,
    latitude_deg DOUBLE PRECISION NOT NULL,
    longitude_deg DOUBLE PRECISION NOT NULL
);

-- Notify trigger
CREATE OR REPLACE FUNCTION notify_tracker() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('tracker_update', '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tracker_trigger ON kosmos_tracker_data;
CREATE TRIGGER tracker_trigger
AFTER INSERT ON kosmos_tracker_data
FOR EACH ROW EXECUTE FUNCTION notify_tracker();
