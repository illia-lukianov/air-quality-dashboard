"use client";

import L, { type LatLngBoundsExpression } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import styles from "./page.module.css";

type StationLocation = {
  id: string;
  city: string;
  status: string;
  source: string;
  parameters: string;
  latitude: number;
  longitude: number;
};

function FitStations({ locations }: { locations: StationLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;
    const bounds: LatLngBoundsExpression = locations.map(
      ({ latitude, longitude }) => [latitude, longitude],
    );
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
  }, [locations, map]);

  return null;
}

const stationIcon = L.divIcon({
  className: styles.mapMarker,
  html: "<span></span>",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function StationMap({
  locations,
}: {
  locations: StationLocation[];
}) {
  return (
    <div className={styles.mapCanvas}>
      <MapContainer
        center={[48.3794, 31.1656]}
        zoom={6}
        scrollWheelZoom
        className={styles.leafletMap}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitStations locations={locations} />
        {locations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={stationIcon}
          >
            <Popup>
              <div className={styles.stationPopup}>
                <strong>
                  {station.city ? `${station.city} · ` : ""}
                  Станція {station.id}
                </strong>
                {station.status && <span>Статус: {station.status}</span>}
                {station.source && <span>Джерело: {station.source}</span>}
                {station.parameters && (
                  <span>Показники: {station.parameters}</span>
                )}
                <span>
                  {station.latitude.toFixed(5)}, {station.longitude.toFixed(5)}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
