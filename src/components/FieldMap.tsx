import { useEffect, useState, type ReactNode } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useI18n } from "../i18n";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const fieldIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Layer = "map" | "satellite";

const MAX_NATIVE_ZOOM = 17;
const MAX_ZOOM = 18;

interface FieldMapProps {
  lat: number | null;
  lon: number | null;
  onPick: (lat: number, lon: number) => void;
  searchSlot?: ReactNode;
  children?: ReactNode;
}

function ResizeFix() {
  const map = useMap();
  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize());

    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap();
  if (lat != null && lon != null) {
    const current = map.getCenter();
    if (Math.abs(current.lat - lat) > 1e-4 || Math.abs(current.lng - lon) > 1e-4) {
      map.flyTo([lat, lon], Math.max(map.getZoom(), 12), { duration: 0.8 });
    }
  }
  return null;
}

export default function FieldMap({ lat, lon, onPick, searchSlot, children }: FieldMapProps) {
  const { d } = useI18n();
  const [layer, setLayer] = useState<Layer>("satellite");

  const center: [number, number] = lat != null && lon != null ? [lat, lon] : [38, 68];
  const zoom = lat != null && lon != null ? 12 : 5;

  return (
    <div className={"map-wrap" + (layer === "map" ? " map-soft-tiles" : "")}>
      <div className="map-topbar">
        {searchSlot && <div className="map-search-slot">{searchSlot}</div>}
        <div className="map-toggle" role="group" aria-label={d.field.mapStyle}>
          <button
            type="button"
            className={"map-toggle-btn" + (layer === "map" ? " active" : "")}
            aria-pressed={layer === "map"}
            onClick={() => setLayer("map")}
          >
            {d.field.layerMap}
          </button>
          <button
            type="button"
            className={"map-toggle-btn" + (layer === "satellite" ? " active" : "")}
            aria-pressed={layer === "satellite"}
            onClick={() => setLayer("satellite")}
          >
            {d.field.layerSatellite}
          </button>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        maxZoom={MAX_ZOOM}
        className="map-canvas"
        scrollWheelZoom
        zoomControl={false}
      >
        {layer === "map" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={MAX_ZOOM}
          />
        ) : (
          <>
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={MAX_NATIVE_ZOOM}
              maxZoom={MAX_ZOOM}
            />
            <TileLayer
              attribution="Labels &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={MAX_NATIVE_ZOOM}
              maxZoom={MAX_ZOOM}
              pane="overlayPane"
            />
          </>
        )}

        <ZoomControl position="bottomright" />

        <ResizeFix />
        <ClickHandler onPick={onPick} />
        <Recenter lat={lat} lon={lon} />

        {lat != null && lon != null && (
          <Marker
            position={[lat, lon]}
            icon={fieldIcon}
            draggable
            eventHandlers={{
              dragend(e) {
                const m = e.target as L.Marker;
                const p = m.getLatLng();
                onPick(p.lat, p.lng);
              },
            }}
          />
        )}
      </MapContainer>

      {children && <div className="map-bottomleft">{children}</div>}
    </div>
  );
}
