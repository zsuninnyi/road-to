import { decodePolyline } from '@road-to/domain';
import { LngLatBounds, Map } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

function lineCoordinates(
  latlng: number[][] | null,
  polyline: string | null,
): Array<[number, number]> {
  if (latlng && latlng.length > 1) {
    const points: Array<[number, number]> = [];
    for (const point of latlng) {
      if (point.length >= 2 && point[0] != null && point[1] != null) {
        points.push([point[1], point[0]]);
      }
    }
    return points;
  }
  if (polyline) {
    return decodePolyline(polyline).map(([lat, lng]) => [lng, lat]);
  }
  return [];
}

export function ActivityMap({
  latlng,
  polyline,
}: {
  latlng: number[][] | null;
  polyline: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coordinates = lineCoordinates(latlng, polyline);

  useEffect(() => {
    const container = containerRef.current;
    const line = lineCoordinates(latlng, polyline);
    const start = line[0];
    if (!container || !start || line.length < 2) {
      return;
    }

    const map = new Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/positron',
    });

    const drawRoute = () => {
      if (map.getSource('route')) {
        return;
      }
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: line },
        },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#0f766e',
          'line-width': 3,
        },
      });
      const bounds = line.reduce((acc, coord) => acc.extend(coord), new LngLatBounds(start, start));
      map.fitBounds(bounds, { padding: 32, maxZoom: 14 });
      map.resize();
    };

    if (map.loaded()) {
      drawRoute();
    } else {
      map.once('load', drawRoute);
    }

    return () => {
      map.remove();
    };
  }, [latlng, polyline]);

  if (coordinates.length < 2) {
    return null;
  }

  return (
    <div className="mt-6 h-72 w-full overflow-hidden rounded-md border border-line">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
